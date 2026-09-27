// test-reengagement.js — deterministic coverage for the proactive re-engagement
// system (smart tips / inactivity tiers / comeback + surprise inbox rewards).
// Engine: utils/reEngagement.js, DB layer: db/index.js.
process.env.DB_PATH = '/tmp/reengage_test';
const fs = require('fs');
fs.rmSync('/tmp/reengage_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/reengage_test', { recursive: true });

const assert = require('assert');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + label + (extra ? '  — ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  — ' + extra : '')); }
};

(async () => {
  const db = require('../db');
  await db.init();
  const eng = require('../utils/reEngagement');

  const NOW = Math.floor(Date.now() / 1000);
  const DAY = 86400;

  // ---- tiny stub client that records every DM ----
  const sentLog = [];
  function makeClient(failIds = new Set()) {
    return {
      isReady: () => true,
      users: { fetch: (id) => {
        if (failIds.has(id)) return Promise.reject(new Error('dm closed'));
        return Promise.resolve({ id, bot: false, send: (t) => { sentLog.push({ id, t }); return Promise.resolve(); } });
      } },
    };
  }
  const seqRand = (vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

  function reset() {
    for (const t of ['users', 'user_activity', 'reengage_state', 'notify_prefs', 'reward_grants', 'inbox_deliveries', 'weapon_crates', 'teams', 'quests', 'animals', 'animals_weapon', 'weapons_inv', 'garden_meta']) {
      try { db.exec(`DELETE FROM ${t}`); } catch {}
    }
    db.exec(`UPDATE reengage_global SET day='_', dm_count=0, gift_count=0, fail_count=0, last_sweep_at=0 WHERE id=1`);
    sentLog.length = 0;
    eng.resetHourBudget && eng.resetHourBudget();
  }

  // seed one user with full control over the signals the engine reads
  function seed(id, o = {}) {
    db.exec(`INSERT OR REPLACE INTO users (user_id, balance, bank, total_gambled, gems, eggs) VALUES ('${id}', ${o.wallet || 0}, ${o.bank || 0}, ${o.gambled || 0}, ${o.gems || 0}, ${o.eggs || 0})`);
    const lastCmd = o.lastCmd === undefined ? NOW - 1 : o.lastCmd;
    const lastMe = o.lastMeaningful === undefined ? NOW - 1 : o.lastMeaningful;
    db.exec(`INSERT OR REPLACE INTO user_activity (user_id, first_seen, last_command_at, last_meaningful_at, last_summon_at, summon_opt_out, last_dm_ok)
             VALUES ('${id}', ${o.firstSeen || NOW - 30 * DAY}, ${lastCmd}, ${lastMe}, ${o.summonAt || 0}, ${o.optOut ? 1 : 0}, 1)`);
    if (o.crates) db.exec(`INSERT OR REPLACE INTO weapon_crates (user_id, qty) VALUES ('${id}', ${o.crates})`);
    if (o.teamSlots !== undefined) {
      const slots = [1, 2, 3].slice(0, o.teamSlots);
      while (slots.length < 3) slots.push('NULL');
      db.exec(`INSERT OR REPLACE INTO teams (user_id, slot1, slot2, slot3) VALUES ('${id}', ${slots.join(',')})`);
    }
    if (o.quest) db.exec(`INSERT INTO quests (user_id, day, quest_key, progress, target, reward, claimed) VALUES ('${id}', 1, 'hunt', ${o.quest.progress}, ${o.quest.target}, 1000, 0)`);
    if (o.garden) db.exec(`INSERT OR REPLACE INTO garden_meta (user_id) VALUES ('${id}')`);
  }
  function addAnimal(id, species, n = 1, rarity = 'COMMON') {
    for (let i = 0; i < n; i++) db.exec(`INSERT INTO animals (user_id, species, rarity, name) VALUES ('${id}', '${species}', '${rarity}', 'p')`);
  }
  function pendingCount(id) {
    const r = db.exec(`SELECT COUNT(*) FROM inbox_deliveries WHERE recipient_id='${id}' AND status='pending'`);
    return r.length ? r[0].values[0][0] : 0;
  }

  await runSuite(db, eng, { NOW, DAY, makeClient, seqRand, reset, seed, addAnimal, pendingCount, check, sentLog });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

async function runSuite(db, eng, H) {
  const { NOW, DAY, makeClient, seqRand, reset, seed, addAnimal, pendingCount, check, sentLog } = H;

  const sweep = async (client, nowSec, rand) => eng.runReEngagementSweep({ client, nowSec: nowSec || NOW, rand: rand || Math.random });
  const dmsFor = (id) => sentLog.filter(s => s.id === id);
  await reset();

  // ---- 1. active user never gets an inactivity DM ----
  {
    const c = makeClient();
    seed('u-active', { wallet: 1000, lastCmd: NOW - 3600, lastMeaningful: NOW - 3600 });
    const st = await sweep(c, NOW);
    check('active user gets no inactivity DM', st.inactivityDms === 0 && dmsFor('u-active').length === 0);
  }

  // ---- 2. 7d inactivity -> tier DM only, no gift, cooldown set ----
  {
    const c = makeClient();
    seed('u-7d', { lastCmd: NOW - 7 * DAY, lastMeaningful: NOW - 7 * DAY - 3600 });
    const st = await sweep(c, NOW);
    const dm = dmsFor('u-7d');
    check('7d: one inactivity DM', st.inactivityDms >= 1 && dm.length === 1, `dms=${dm.length}`);
    check('7d: no gift at this tier', pendingCount('u-7d') === 0 && st.returnGifts === 0);
    const st2 = db.getReengageState('u-7d');
    check('7d: inactivity cooldown persisted', st2 && st2.last_inactivity_dm_at > 0 && st2.last_inactivity_tier === 7);
  }

  // ---- 3. 14d inactivity -> chance gift (poor) + DM ----
  {
    const c = makeClient();
    reset();
    seed('u-14', { wallet: 500, lastCmd: NOW - 14 * DAY, lastMeaningful: NOW - 14 * DAY - 3600 });
    const st = await sweep(c, NOW, seqRand([0.1]));
    check('14d: gift chance 50% rolls in', pendingCount('u-14') === 1, `pending=${pendingCount('u-14')}`);
    const d = db.getPendingDeliveries('u-14', 1)[0];
    check('14d: poor gift amount = 200k', d.amount === 200000, `amt=${d.amount}`);
    check('14d: delivery is source=comeback', d.source === 'comeback');
    check('14d: DM sent (has gift hint)', dmsFor('u-14').length === 1);
    check('14d: return-gift state set', (db.getReengageState('u-14') || {}).last_return_gift_at > 0);
  }

  // ---- 4. 30d inactivity -> guaranteed gift at poor tier ----
  {
    const c = makeClient();
    reset();
    seed('u-30', { wallet: 0, lastCmd: NOW - 30 * DAY, lastMeaningful: NOW - 30 * DAY - 3600 });
    const st = await sweep(c, NOW, seqRand([0.9]));
    const d = db.getPendingDeliveries('u-30', 1)[0];
    check('30d: guaranteed comeback gift', pendingCount('u-30') === 1 && d.amount === 500000, `amt=${d ? d.amount : 0}`);
  }

  // ---- 5. 60d inactivity -> rare bigger gift ----
  {
    const c = makeClient();
    reset();
    seed('u-60', { wallet: 200, lastCmd: NOW - 60 * DAY, lastMeaningful: NOW - 60 * DAY - 3600 });
    await sweep(c, NOW, seqRand([0.1]));
    const d = db.getPendingDeliveries('u-60', 1)[0];
    check('60d: rare tier gift = 1.5M (poor)', d && d.amount === 1500000, `amt=${d ? d.amount : 0}`);
  }

  // ---- 6. notifications off (all) -> silence ----
  {
    const c = makeClient();
    reset();
    db.setNotifyPrefs('u-off', { tips: false, inactivity: false, rewards: false });
    seed('u-off', { lastCmd: NOW - 30 * DAY, lastMeaningful: NOW - 30 * DAY - 3600 });
    const st = await sweep(c, NOW, seqRand([0.1]));
    check('all notifications off -> no DM, no gift', pendingCount('u-off') === 0 && dmsFor('u-off').length === 0);
  }

  // ---- 7. tips-only off -> inactivity still works ----
  {
    const c = makeClient();
    reset();
    db.setNotifyPrefs('u-tipoff', { tips: false });
    seed('u-tipoff', { wallet: 500000, bank: 0, lastCmd: NOW - 14 * DAY, lastMeaningful: NOW - 14 * DAY - 3600 });
    await sweep(c, NOW, seqRand([0.9]));
    check('tips off: inactivity DM still sent', dmsFor('u-tipoff').length === 1);
  }

  // ---- 8. rewards-only off -> DM but no gift ----
  {
    const c = makeClient();
    reset();
    db.setNotifyPrefs('u-rewoff', { rewards: false });
    seed('u-rewoff', { lastCmd: NOW - 30 * DAY, lastMeaningful: NOW - 30 * DAY - 3600 });
    const st = await sweep(c, NOW, seqRand([0.1]));
    check('rewards off: no gift generated', pendingCount('u-rewoff') === 0 && st.returnGifts === 0);
    check('rewards off: inactivity DM still sent', dmsFor('u-rewoff').length === 1);
  }

  // ---- 9. DMs closed -> silent fail, no crash, no retry loop ----
  {
    const c = makeClient(new Set(['u-closed']));
    reset();
    seed('u-closed', { lastCmd: NOW - 7 * DAY, lastMeaningful: NOW - 7 * DAY - 3600 });
    const st = await sweep(c, NOW, seqRand([0.9]));
    check('DM closed: silently skipped (no throw)', st.inactivityDms === 0);
    const g = db.getReengageGlobal(NOW);
    check('DM closed: failure recorded', g.failCount >= 1, `fails=${g.failCount}`);
    check('DM closed: cooldown NOT burned', !(db.getReengageState('u-closed') || {}).last_inactivity_dm_at);
  }

  // ---- 10. repeated sweep (same window) = no duplicate ----
  {
    const c = makeClient();
    reset();
    seed('u-rpt', { lastCmd: NOW - 14 * DAY, lastMeaningful: NOW - 14 * DAY - 3600 });
    await sweep(c, NOW, seqRand([0.1]));
    const after1 = { gifts: pendingCount('u-rpt'), dms: dmsFor('u-rpt').length, grants: db.exec('SELECT COUNT(*) FROM reward_grants')[0].values[0][0] };
    const st2 = await sweep(c, NOW, seqRand([0.1]));
    check('repeat sweep: no duplicate gift', pendingCount('u-rpt') === after1.gifts, `pending=${pendingCount('u-rpt')}`);
    check('repeat sweep: no duplicate DM', dmsFor('u-rpt').length === after1.dms);
    check('repeat sweep: no extra grant row', db.exec('SELECT COUNT(*) FROM reward_grants')[0].values[0][0] === after1.grants);
  }

  // ---- 11. restart = no duplicate (token dedupe via grantRewardOnce) ----
  {
    reset();
    const r1 = db.grantRewardOnce('u-restart', 'return30', 'return30:u-restart:999', 500000, { label: 'x' });
    const r2 = db.grantRewardOnce('u-restart', 'return30', 'return30:u-restart:999', 500000, { label: 'x' });
    check('token dedupe: second grant refused', r1.ok && !r2.ok && r2.reason === 'exists');
    check('token dedupe: exactly one delivery', pendingCount('u-restart') === 1);
  }

  // ---- 12. pending comeback reward blocks another ----
  {
    const c = makeClient();
    reset();
    db.grantRewardOnce('u-block', 'return14', 'return14:u-block:1', 1000, { label: 'x' });
    seed('u-block', { lastCmd: NOW - 14 * DAY, lastMeaningful: NOW - 14 * DAY - 3600 });
    const st = await sweep(c, NOW, seqRand([0.1]));
    check('pending comeback blocks new gift', st.returnGifts === 0 && pendingCount('u-block') === 1);
  }

  // ---- 13. claim behavior ----
  {
    const c = makeClient();
    reset();
    db.grantRewardOnce('u-claim', 'return14', 'return14:u-claim:1', 200000, { label: 'x' });
    db.ensureUser('u-claim');
    const before = db.getBalance('u-claim');
    const d = db.getPendingDeliveries('u-claim', 1)[0];
    const res = db.safeClaim(d.id, 'u-claim');
    check('claim credits the amount', res.ok && db.getBalance('u-claim') === before + 200000);
    const res2 = db.safeClaim(d.id, 'u-claim');
    check('claim is exactly-once', !res2.ok);
  }

  // ---- 14. cooldown persistence (no farming by re-remaining idle) ----
  {
    const c = makeClient();
    reset();
    seed('u-cd', { lastCmd: NOW - 14 * DAY, lastMeaningful: NOW - 14 * DAY - 3600 });
    await sweep(c, NOW, seqRand([0.1]));
    const before = { gifts: pendingCount('u-cd'), dms: dmsFor('u-cd').length };
    // still idle 10 days later, inside the 45d cooldown
    const st2 = await sweep(c, NOW + 10 * DAY, seqRand([0.1, 0.9]));
    check('cooldown: no second gift while cooling', pendingCount('u-cd') === before.gifts);
    check('cooldown: no second DM while cooling', dmsFor('u-cd').length === before.dms);
    // after cooldown + past the bucket a NEW grant is possible (fresh token)
    // note: idle jumped to the 60d tier here, so its 90d DM cooldown must lapse too
    const st3 = await sweep(c, NOW + 91 * DAY, seqRand([0.9]));
    check('cooldown: new window allows re-engagement', st3.inactivityDms >= 1, `dms=${st3.inactivityDms}`);
  }

  // ---- 15. bank tip only when meaningful ----
  {
    const s = eng.buildSignals();
    const tipHigh = eng.pickTipForUser('x', s, 1000000, 0, 0);
    const tipLow = eng.pickTipForUser('x', s, 500, 0, 0);
    const tipProtected = eng.pickTipForUser('x', s, 1000000, 900000, 0);
    check('bank tip fires when wallet is at robbery risk', tipHigh && tipHigh.key === 'bank');
    check('no bank tip for tiny wallets', !tipLow || tipLow.key !== 'bank');
    check('no bank tip when bank already protects', !tipProtected || tipProtected.key !== 'bank');
  }

  // ---- 16. inbox tip only with pending items ----
  {
    reset();
    seed('u-inbox', { wallet: 500 });
    db.createDelivery('u-inbox', { source: 'gift', label: 't', amount: 50, payload: {} });
    const st = await sweep(makeClient(), NOW, seqRand([0.9]));
    check('inbox tip DM fired', dmsFor('u-inbox').length === 1, `dms=${dmsFor('u-inbox').length}`);
    check('inbox tip text mentions inbox', (dmsFor('u-inbox')[0] || { t: '' }).t.includes('inbox'));
  }

  // ---- 17. team tip only with pets + empty team ----
  {
    seed('u-team', {});
    addAnimal('u-team', 'Fish', 6);
    const s = eng.buildSignals();
    const tipNoTeam = eng.pickTipForUser('u-team', s, 500, 0, 0);
    check('team tip when pets + no team', tipNoTeam && tipNoTeam.key === 'team');
    seed('u-team2', { teamSlots: 2 });
    addAnimal('u-team2', 'Fish', 6);
    const s2 = eng.buildSignals();
    const tipHasTeam = eng.pickTipForUser('u-team2', s2, 500, 0, 0);
    check('no team tip when team already set', !tipHasTeam || tipHasTeam.key !== 'team');
  }

  // ---- 18. crate tip only with crates ----
  {
    seed('u-crate', { crates: 3 });
    const s = eng.buildSignals();
    const tip = eng.pickTipForUser('u-crate', s, 500, 0, 0);
    check('crate tip with unopened crates', tip && tip.key === 'crates');
    seed('u-crate0', {});
    const s2 = eng.buildSignals();
    const tip0 = eng.pickTipForUser('u-crate0', s2, 500, 0, 0);
    check('no crate tip with none', !tip0 || tip0.key !== 'crates');
  }

  // ---- 19. never targets gambling losses ----
  {
    const s = eng.buildSignals();
    reset();
    seed('u-loss', { wallet: 900000, bank: 0, gambled: 50000000 });
    db.exec(`UPDATE users SET loss_streak = 9, last_loss_time = ${NOW - 3600} WHERE user_id='u-loss'`);
    const s2 = eng.buildSignals();
    const tip = eng.pickTipForUser('u-loss', s2, 900000, 0, 0);
    const t = (tip && tip.line || '').toLowerCase();
    check('tip nevers mentions losses/gambling even with huge losses', !t.includes('loss') && !t.includes('gambl') && !t.includes('streak'),
      tip ? t.slice(0, 60) : 'no-tip');
    check('loss data is never a trigger', !(s2 && Object.keys(s2).length && tip && /recommend.*(slots?|dice|roulette|mines)/i.test(t)));
  }

  // ---- 20. reward amounts within configured caps ----
  {
    const g = eng.RETURN_GIFTS;
    let okAmt = true, okRich = true;
    for (const k of ['14', '30', '60']) {
      if (g[k].poor > 2000000 || g[k].mid > 2000000) okAmt = false;
      if (!(g[k].rich === null)) okRich = false;
    }
    check('all return amounts <= 2M (economy caps)', okAmt);
    check('rich tier always payload, never cash', okRich);
    const r = eng.pickReturnGift(30, 50000000);
    check('rich player gets gems+crate payload, 0 cash', r.amount === 0 && r.payload.gems === 25 && r.payload.crates === 1);
  }

  // ---- 21. reward creation exactly once at sweep level ----
  {
    reset();
    const c = makeClient();
    seed('u-once', { lastCmd: NOW - 30 * DAY, lastMeaningful: NOW - 30 * DAY - 3600 });
    await sweep(c, NOW, seqRand([0.9]));
    await sweep(c, NOW, seqRand([0.9]));
    const grants = db.exec(`SELECT COUNT(*) FROM reward_grants WHERE user_id='u-once'`)[0].values[0][0];
    check('exactly one grant row after 2 sweeps', grants === 1 && pendingCount('u-once') === 1);
  }

  // ---- 22. 1000-user simulated sweep: sane volume, unique tokens ----
  {
    const c = makeClient();
    reset();
    for (let i = 0; i < 900; i++) {
      seed('act' + i, { wallet: 3000, lastCmd: NOW - 3600, lastMeaningful: NOW - 3600 });
    }
    for (let i = 0; i < 100; i++) {
      seed('idle' + i, { wallet: 2000, lastCmd: NOW - 35 * DAY, lastMeaningful: NOW - 35 * DAY - 3600 });
    }
    const st = await sweep(c, NOW, seqRand([0.1, 0.5, 0.9]));
    check('sim: pro-active DMs within daily budget', sentLog.length <= eng.GLOBAL_DAILY_DM_MAX, `sent=${sentLog.length}`);
    const allTokens = db.exec('SELECT COUNT(*) c, COUNT(DISTINCT token) d FROM reward_grants')[0].values[0];
    check('sim: reward grant tokens are unique', allTokens[0] === allTokens[1], `${allTokens[0]}/${allTokens[1]}`);
    // repeated sweep TODAY must not double anything
    sentLog.length = 0;
    const before = db.exec('SELECT COUNT(*) FROM reward_grants')[0].values[0][0];
    await sweep(c, NOW, seqRand([0.1, 0.5, 0.9]));
    const after = db.exec('SELECT COUNT(*) FROM reward_grants')[0].values[0][0];
    check('sim: second sweep adds zero grants', after === before && sentLog.length === 0, `grants ${before}->${after}`);
  }

  // ---- 23. welcome-back fires once, in-channel, only for an unwelcomed gift ----
  {
    reset();
    db.grantRewardOnce('u-w', 'return30', 'return30:u-w:1', 500000, { label: 'x' });
    const chanMsgs = [];
    const channel = { send: (m) => { chanMsgs.push(String(m)); return Promise.resolve(); } };
    await eng.maybeWelcomeBack(makeClient(), 'u-w', channel);
    check('welcome-back sent in channel once', chanMsgs.length === 1 && chanMsgs[0].includes('welcome back'));
    check('welcome token persisted', (db.getReengageState('u-w') || {}).welcome_token === 'return30:u-w:1');
    await eng.maybeWelcomeBack(makeClient(), 'u-w', channel);
    check('welcome-back does not duplicate', chanMsgs.length === 1);
    // after claiming, no gift -> no welcome
    const c = makeClient();
    db.ensureUser('u-w');
    db.safeClaim(db.getPendingDeliveries('u-w', 1)[0].id, 'u-w');
    await eng.maybeWelcomeBack(c, 'u-w', channel);
    check('welcome-back silent after claim', chanMsgs.length === 1);
  }
}