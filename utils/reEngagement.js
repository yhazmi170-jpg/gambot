// Proactive re-engagement engine: state-aware tips (DMs), inactivity tiers with
// comeback gifts via the inbox, and rare active-user surprise gifts.
//
// Design rules (2026-09, owner-approved):
//  - central engine, no DM logic scattered through commands
//  - every DM single-line, natural, never about gambling / losses
//  - conservative: one proactive tip every ~5d for active users, tier DMs with
//    long cooldowns, one unclaimed comeback gift at a time
//  - rewards ALWAYS via inbox (createDelivery), never direct balance
//  - exactly-once via reward_grants tokens + pending-source checks
//  - sweep is idempotent, all state in DB (survives restarts / sleep)

const db = require('../db');

const DAY = 86400;

// ---- Active-user tip cadence ----
const TIP_MIN_GAP = 4 * DAY;          // never DM a tip more often than this
const TIP_SAME_TYPE_GAP = 30 * DAY;   // don't repeat the same tip type sooner than this
const ACTIVE_WINDOW = 3 * DAY;        // "active" = command within 3 days

// ---- Inactivity tiers (days ascending) ----
const TIERS = [
  { days: 7, chance: 0, dmCooldown: 30 * DAY, giftCooldown: 0, dm: () => '👋 been a minute — missed you around here. `v try` to see what\u0027s new.' },
  { days: 14, chance: 0.5, dmCooldown: 45 * DAY, giftCooldown: 45 * DAY, dm: (g) => `👋 been a while. ${g ? 'something small is waiting in ' : ''}\`v inbox\`${g ? '' : ' — use \`v try\` to see what\u0027s new.'}` },
  { days: 30, chance: 1.0, dmCooldown: 60 * DAY, giftCooldown: 60 * DAY, dm: () => '👋 damn, been a minute. a comeback gift is sitting in `v inbox` when you\u0027re back.' },
  { days: 60, chance: 0.3, dmCooldown: 90 * DAY, giftCooldown: 60 * DAY, dm: () => '👋 last time I saw you was ages ago. left you something proper in `v inbox`.' },
];

// Comeback gift amounts by wealth tier. poor = wallet+bank <= 100k,
// rich = > 10M. Rich gets gems/crates, never more cash (no wallet inflation).
const WEALTH = { poorCap: 100000, richCap: 10000000 };
const RETURN_GIFTS = {
  14: { poor: 200000, mid: 150000, rich: null, richPayload: { gems: 8 } },
  30: { poor: 500000, mid: 350000, rich: null, richPayload: { gems: 25, crates: 1 } },
  60: { poor: 1500000, mid: 1000000, rich: null, richPayload: { gems: 40, crates: 1 } },
};

// ---- Surprise active-player gifts ----
const SURPRISE_DAILY_CHANCE = 0.005; // per active user per day
const SURPRISE_COOLDOWN = 30 * DAY;
const SURPRISE_LIFETIME_CAP = 12;

// ---- Global budgets ----
const GLOBAL_DAILY_DM_MAX = 40;
const GLOBAL_HOURLY_DM_MAX = 4;
const GLOBAL_DAILY_GIFT_MAX = 5;

function wealthTier(totalWealth) {
  if (totalWealth <= WEALTH.poorCap) return 'poor';
  if (totalWealth <= WEALTH.richCap) return 'mid';
  return 'rich';
}

// Deterministic per-user per-day roll (surprise gifts never farmable).
function dailyRoll(userId, dayStr, chance) {
  let h = 0;
  const key = userId + ':' + dayStr;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 100000) / 100000 < chance;
}

// Cheap per-user state batched into maps in ONE sweep; only the handful of
// final candidates ever pay for extra per-user context.
function buildSignals() {
  const q = (s) => { try { return db.exec(s); } catch { return []; } };
  const rows = (s) => { const r = q(s); return (r.length && r[0].values.length) ? r[0].values : []; };
  const out = { crates: new Map(), animals: new Map(), species: new Map(), teams: new Map(), eggs: new Map(), gems: new Map(), weapons: new Map(), equipped: new Set(), quests: new Map(), garden: new Set() };
  for (const [u, n] of rows('SELECT user_id, qty FROM weapon_crates WHERE qty > 0')) out.crates.set(u, n);
  for (const [u, n] of rows('SELECT user_id, COUNT(*) FROM animals GROUP BY user_id')) out.animals.set(u, n);
  for (const [u, n] of rows('SELECT user_id, COUNT(DISTINCT species) FROM animals GROUP BY user_id')) out.species.set(u, n);
  for (const [u, a, b, c] of rows('SELECT user_id, slot1, slot2, slot3 FROM teams')) out.teams.set(u, [a, b, c].filter(v => v != null).length);
  for (const [u, n] of rows('SELECT user_id, eggs FROM users WHERE eggs > 0')) out.eggs.set(u, n);
  for (const [u, n] of rows('SELECT user_id, gems FROM users WHERE gems > 0')) out.gems.set(u, n);
  for (const [u, n] of rows('SELECT user_id, COUNT(*) FROM weapons_inv GROUP BY user_id')) out.weapons.set(u, n);
  for (const [u] of rows('SELECT a.user_id FROM animals_weapon aw JOIN animals a ON a.id = aw.animal_id')) out.equipped.add(u);
  for (const [u, p, t, claimed] of rows('SELECT user_id, progress, target, claimed FROM quests WHERE claimed = 0 AND progress > 0')) out.quests.set(u, { progress: p, target: t, claimed });
  for (const [u] of rows('SELECT user_id FROM garden_meta')) out.garden.add(u);
  return out;
}

function nextDexMilestoneNeed(owned) {
  try {
    const ms = db.DEX_MILESTONES || [];
    for (const m of ms) if (typeof m[0] === 'number' && owned < m[0]) return m[0];
  } catch {}
  return null;
}

// Highest-priority state-aware tip for one user, from cheap signals only.
// Returns { key, line } or null. Never mentions gambling.
function pickTipForUser(userId, s, wallet, bank, pendingInbox) {
  const total = wallet + bank;
  if (wallet >= 30000 && bank < wallet * 0.2) {
    return { key: 'bank', line: `💰 You've got **${wallet.toLocaleString()}** sitting in your wallet where it can be robbed. Park some with \`v bank deposit all\` — bank money can\u0027t be robbed.` };
  }
  if (pendingInbox > 0) {
    return { key: 'inbox', line: `📬 You've got ${pendingInbox} delivery${pendingInbox === 1 ? '' : 's'} waiting — \`v inbox\`` };
  }
  const crates = s.crates.get(userId) || 0;
  if (crates > 0) {
    return { key: 'crates', line: `📦 You still have ${crates} weapon crate${crates === 1 ? '' : 's'} — \`v wc open all\`` };
  }
  const petCount = s.animals.get(userId) || 0;
  const slots = s.teams.get(userId) || 0;
  if (petCount >= 3 && slots === 0) {
    return { key: 'team', line: '🐾 You\u0027ve got pets but no battle team yet — `v team` to build one (weapons only work on team pets).' };
  }
  const weaponsCount = s.weapons.get(userId) || 0;
  if (weaponsCount > 0 && !s.equipped.has(userId)) {
    return { key: 'weapon', line: '⚔️ You own a weapon but none equipped — teams hit harder with one (`v weapon list` → `v weapon equip`).' };
  }
  const speciesCount = s.species.get(userId) || 0;
  if (speciesCount > 0 && speciesCount < 92) {
    const need = nextDexMilestoneNeed(speciesCount);
    if (need !== null && need - speciesCount > 0 && need - speciesCount <= 5) {
      return { key: 'dex', line: `📖 You're ${need - speciesCount} species from your next dex milestone — \`v dex\`` };
    }
  }
  const q = s.quests.get(userId);
  if (q && q.target > 1 && q.progress / q.target >= 0.5) {
    return { key: 'quest', line: `🎯 Your daily quest is ${Math.floor((q.progress / q.target) * 100)}% done (${q.progress}/${q.target}) — \`v quest\`` };
  }
  const eggs = s.eggs.get(userId) || 0;
  if (eggs >= 1) {
    return { key: 'eggs', line: `🥚 You've got ${eggs} unhatched egg${eggs === 1 ? '' : 's'} doing nothing — \`v hatch\`` };
  }
  if (!s.garden.has(userId) && total >= 50000) {
    return { key: 'garden', line: '🌻 Your snail garden\u0027s waiting — `v garden` to see your runner, upgrades and progress.' };
  }
  return null;
}

function pickReturnGift(tierDays, totalWealth) {
  const t = wealthTier(totalWealth);
  const row = RETURN_GIFTS[tierDays];
  if (!row) return { amount: 0, payload: {} };
  if (row[t] === null) return { amount: 0, payload: row.richPayload };
  return { amount: row[t], payload: {} };
}

function rollSurprise(totalWealth, rand) {
  const t = wealthTier(totalWealth);
  const roll = rand();
  if (t === 'rich') {
    if (roll < 0.6) return { amount: 0, payload: { gems: 5 + Math.floor(rand() * 6) } };
    return { amount: 0, payload: { crates: 1 } };
  }
  if (roll < 0.4) return { amount: 20000 + Math.floor(rand() * 130000) };
  if (roll < 0.7) return { amount: 0, payload: { gems: 5 + Math.floor(rand() * 8) } };
  return { amount: 0, payload: { crates: 1 } };
}

function sendProactiveDm(client, userId, text) {
  return client.users.fetch(userId).then(u => {
    if (!u || u.bot) throw new Error('nouser');
    return u.send(text);
  }).then(() => {
    try { db.setLastDmOk(userId, true); } catch {}
    return true;
  }).catch(() => {
    try { db.setLastDmOk(userId, false); } catch {}
    try { db.bumpReengageCounters(0, 0, 1); } catch {}
    return false;
  });
}

// Hourly guard is in-memory (per-day guard is persistent in DB — conservative either way).
const recentHourly = [];
function hourBudgetOk() {
  const now = Date.now();
  while (recentHourly.length && recentHourly[0] < now - 3600000) recentHourly.shift();
  return recentHourly.length < GLOBAL_HOURLY_DM_MAX;
}
function consumeHourBudget() { recentHourly.push(Date.now()); }
function resetHourBudget() { recentHourly.length = 0; }

// Main sweep. Idempotent: all eligibility/cooldowns are DB state; tokens dedupe.
async function runReEngagementSweep({ client, nowSec, rand = Math.random }) {
  const stats = { checked: 0, tips: 0, inactivityDms: 0, returnGifts: 0, surprises: 0, skipped: [] };
  if (!client || !client.isReady || !client.isReady()) return stats;
  const now = nowSec || Math.floor(Date.now() / 1000);

  const users = db.getAllUsers();
  const signals = buildSignals();
  const activityMap = new Map();
  const stateMap = new Map();
  const prefMap = new Map();
  try {
    const actRows = db.exec('SELECT user_id, last_command_at, last_meaningful_at, last_summon_at, summon_opt_out, first_seen FROM user_activity');
    if (actRows.length && actRows[0].values.length) for (const v of actRows[0].values) activityMap.set(v[0], { lastCommandAt: v[1], lastMeaningfulAt: v[2], lastSummonAt: v[3], optOut: v[4] === 1, firstSeen: v[5] });
    const stRows = db.exec('SELECT user_id, last_tip_at, last_tip_type, tip_count, last_inactivity_dm_at, last_inactivity_tier, last_return_gift_at, last_surprise_gift_at, surprise_count, welcome_token FROM reengage_state');
    if (stRows.length && stRows[0].values.length) for (const v of stRows[0].values) stateMap.set(v[0], { lastTipAt: v[1], lastTipType: v[2], tipCount: v[3], lastInactDmAt: v[4], lastInactTier: v[5], lastReturnGiftAt: v[6], lastSurpriseAt: v[7], surpriseCount: v[8], welcomeToken: v[9] });
    const pfRows = db.exec('SELECT user_id, tips, inactivity, rewards FROM notify_prefs');
    if (pfRows.length && pfRows[0].values.length) for (const v of pfRows[0].values) prefMap.set(v[0], { tips: v[1] === 1, inactivity: v[2] === 1, rewards: v[3] === 1 });
  } catch (e) { console.error('[re-engage] batch load error:', (e && e.message) || e); }

  const global = db.getReengageGlobal(now);
  const dayStr = global.day;

  // -------- Pass 1: return gifts + inactivity DMs (idle players) --------
  const idleCandidates = [];
  for (const u of users) {
    const act = activityMap.get(u.user_id);
    if (!act || !act.lastMeaningfulAt) continue;
    const idleDays = (now - act.lastMeaningfulAt) / DAY;
    if (idleDays < 7) continue;
    idleCandidates.push({ user: u, act, idleDays });
  }
  idleCandidates.sort((a, b) => b.idleDays - a.idleDays);
  for (const { user, act, idleDays } of idleCandidates) {
    if (global.dmCount >= GLOBAL_DAILY_DM_MAX && global.giftCount >= GLOBAL_DAILY_GIFT_MAX) break;
    stats.checked++;
    const st = stateMap.get(user.user_id) || {};
    const prefs = prefMap.get(user.user_id) || { tips: true, inactivity: true, rewards: true };

    let tier = null;
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (idleDays >= TIERS[i].days) { tier = TIERS[i]; break; }
    }
    if (!tier) continue;
    const tierDays = tier.days;

    const inactDmBlocked = tier.dmCooldown > 0 && (st.lastInactDmAt || 0) + tier.dmCooldown > now;
    const justSummoned = (act.lastSummonAt || 0) > now - 2 * DAY;

    // Return gift (reward category) — can be granted even when DMs are off (inbox).
    let hasGift = db.hasPendingComeback(user.user_id);
    if (!hasGift && global.giftCount < GLOBAL_DAILY_GIFT_MAX && tier.chance > 0 && prefs.rewards) {
      const giftBlocked = (st.lastReturnGiftAt || 0) + tier.giftCooldown > now;
      if (!giftBlocked && rand() < tier.chance) {
        const total = (user.balance || 0) + (user.bank || 0);
        const r = pickReturnGift(tierDays, total);
        const bucket = Math.floor(now / (tier.giftCooldown || DAY));
        const token = `return${tierDays}:${user.user_id}:${bucket}`;
        const payload = { label: tierDays === 14 ? 'comeback gift (small)' : tierDays === 60 ? 'comeback gift (rare)' : 'comeback gift', ...(r.payload || {}) };
        const res = db.grantRewardOnce(user.user_id, `return${tierDays}`, token, r.amount, payload);
        if (res.ok && !res.recreated) db.touchReengage(user.user_id, { last_return_gift_at: now, last_return_gift_kind: `return${tierDays}` });
        if (res.ok) {
          db.bumpReengageCounters(0, 1, 0);
          global.giftCount++;
          stats.returnGifts++;
          hasGift = true;
        }
      }
    }

    // Inactivity DM (its own category). summon_opt_out = never DM, respected everywhere.
    if (prefs.inactivity && !act.optOut && !inactDmBlocked && !justSummoned && global.dmCount < GLOBAL_DAILY_DM_MAX && hourBudgetOk()) {
      const sent = await sendProactiveDm(client, user.user_id, tier.dm(hasGift));
      if (sent) {
        db.touchReengage(user.user_id, { last_inactivity_dm_at: now, last_inactivity_tier: tierDays });
        db.setSummonTime(user.user_id);
        db.bumpReengageCounters(1, 0, 0);
        global.dmCount++;
        consumeHourBudget();
        stats.inactivityDms++;
      } else {
        stats.skipped.push(user.user_id);
      }
    }
  }

  // -------- Pass 2: proactive tips for active users --------
  const activeCandidates = [];
  for (const u of users) {
    const act = activityMap.get(u.user_id);
    if (!act || !act.lastCommandAt || act.optOut) continue;
    if ((act.lastSummonAt || 0) > now - 2 * DAY) continue;
    if (now - act.lastCommandAt > ACTIVE_WINDOW) continue;
    const prefs = prefMap.get(u.user_id);
    if (prefs && prefs.tips === false) continue;
    const st = stateMap.get(u.user_id) || {};
    if ((st.lastTipAt || 0) + TIP_MIN_GAP > now) continue;
    const tip = pickTipForUser(u.user_id, signals, u.balance || 0, u.bank || 0, u.pending_inbox || 0);
    if (!tip) continue;
    if (tip.key === st.lastTipType && now - (st.lastTipAt || 0) < TIP_SAME_TYPE_GAP) continue;
    activeCandidates.push({ user: u, tip, lastTipAt: st.lastTipAt || 0, tipCount: st.tipCount || 0, tipType: st.lastTipType || '' });
  }
  activeCandidates.sort((a, b) => a.lastTipAt - b.lastTipAt);
  for (let i = activeCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [activeCandidates[i], activeCandidates[j]] = [activeCandidates[j], activeCandidates[i]];
  }
  for (const c of activeCandidates) {
    if (global.dmCount >= GLOBAL_DAILY_DM_MAX || !hourBudgetOk()) break;
    const sent = await sendProactiveDm(client, c.user.user_id, c.tip.line);
    if (sent) {
      db.touchReengage(c.user.user_id, { last_tip_at: now, last_tip_type: c.tip.key, tip_count: c.tipCount + 1 });
      db.bumpReengageCounters(1, 0, 0);
      global.dmCount++;
      consumeHourBudget();
      stats.tips++;
    } else {
      stats.skipped.push(c.user.user_id);
    }
  }

  // -------- Pass 3: rare surprise gifts for active players --------
  if (global.giftCount < GLOBAL_DAILY_GIFT_MAX) {
    for (const u of users) {
      if (global.giftCount >= GLOBAL_DAILY_GIFT_MAX) break;
      const act = activityMap.get(u.user_id);
      if (!act || !act.lastCommandAt || act.optOut) continue;
      if (now - act.lastCommandAt > ACTIVE_WINDOW) continue;
      const prefs = prefMap.get(u.user_id);
      if (prefs && prefs.rewards === false) continue;
      const st = stateMap.get(u.user_id) || {};
      if ((st.lastSurpriseAt || 0) + SURPRISE_COOLDOWN > now) continue;
      if ((st.surpriseCount || 0) >= SURPRISE_LIFETIME_CAP) continue;
      if (!dailyRoll(u.user_id, dayStr, SURPRISE_DAILY_CHANCE)) continue;
      const total = (u.balance || 0) + (u.bank || 0);
      const r = rollSurprise(total, rand);
      const token = `surprise:${u.user_id}:${dayStr}`;
      const res = db.grantRewardOnce(u.user_id, 'surprise', token, r.amount, { label: 'surprise gift', ...(r.payload || {}) });
      if (!res.ok) continue;
      global.giftCount++;
      const sent = await sendProactiveDm(client, u.user_id, '🎁 `v inbox` — Gambot dropped something in there while you were around.');
      if (sent) {
        db.touchReengage(u.user_id, { last_surprise_gift_at: now, surprise_count: (st.surpriseCount || 0) + 1 });
        db.bumpReengageCounters(1, 1, 0);
        global.dmCount++;
        consumeHourBudget();
        stats.surprises++;
      } else {
        db.bumpReengageCounters(0, 1, 0);
        stats.skipped.push(u.user_id);
      }
    }
  }

  db.touchSweep(now);
  return stats;
}

// Once-per-gift in-channel welcome (no DM duplication — the tier DM already
// mentions the gift). Runs after a command; only when a comeback gift is pending
// and not yet welcomed for that gift. Falls back to a DM when in a DM context.
function maybeWelcomeBack(client, userId, channel) {
  if (!client || !client.isReady || !client.isReady()) return Promise.resolve(false);
  try {
    let pending = null;
    try { pending = db.getPendingDeliveries(userId, 5).find(d => d.source === 'comeback'); } catch { return Promise.resolve(false); }
    if (pending) {
      const cur = db.getReengageState(userId) || {};
      const tok = (pending.payload || {}).token || '';
      if (tok && tok !== cur.welcome_token) {
        db.touchReengage(userId, { welcome_token: tok });
        const line = '👋 welcome back — something\u0027s waiting in `v inbox`.';
        if (channel && channel.send) {
          return Promise.resolve(channel.send(line)).then(() => true).catch(() => sendProactiveDm(client, userId, line));
        }
        return sendProactiveDm(client, userId, line);
      }
    }
  } catch (e) {
    try { console.error('[re-engage] welcome error:', (e && e.message) || e); } catch {}
  }
  return Promise.resolve(false);
}

module.exports = {
  TIERS, WEALTH, RETURN_GIFTS, SURPRISE_DAILY_CHANCE, SURPRISE_COOLDOWN, SURPRISE_LIFETIME_CAP,
  GLOBAL_DAILY_DM_MAX, GLOBAL_HOURLY_DM_MAX, GLOBAL_DAILY_GIFT_MAX, TIP_MIN_GAP, ACTIVE_WINDOW,
  runReEngagementSweep, buildSignals, pickTipForUser, pickReturnGift, wealthTier, dailyRoll, maybeWelcomeBack,
  resetHourBudget,
};