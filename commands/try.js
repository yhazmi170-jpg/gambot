const db = require('../db');
const { embed, error } = require('../utils/embed');
const { TIPS, pickPassiveTip } = require('../utils/tips');

// Non-gambling feature catalog. ids == registered command names so usage
// tracking (recordFeatureUse) lines up with what v try reports.
const FEATURES = [
  { id: 'hunt', label: 'Hunting', how: 'v hunt', weight: 3, desc: 'hunt rarity-weighted pets from the wild for coins, gems, eggs and weapon-crate drops' },
  { id: 'hatch', label: 'Hatching', how: 'v hatch', weight: 3, desc: 'open your eggs instead of letting them pile up' },
  { id: 'sacrifice', label: 'Sacrifice', how: 'v sacrifice <species>', weight: 2, desc: 'convert spare animals into essence (common 1 → legendary 100)' },
  { id: 'upgrade', label: 'Trait upgrades', how: 'v upgrade <trait>', weight: 2, desc: 'spend essence on hunt Efficiency/Gain/Radar/XP — the real power curve' },
  { id: 'autohunt', label: 'Autohunt', how: 'v autohunt <mins>', weight: 2, desc: 'hands-off hunting that catches up missed cycles even after the bot sleeps' },
  { id: 'autohuntbot', label: 'Autohunt bot panel', how: 'v autohuntbot', weight: 1, desc: 'your autohunt rank, cycle count and upgrade costs at a glance' },
  { id: 'huntbot', label: 'Hunt panel', how: 'v huntbot', weight: 1, desc: 'essence, traits, bot status and hunt yield in one panel' },
  { id: 'garden', label: 'Snail garden', how: 'v garden <amt>', weight: 1, desc: 'a risky step-by-step planting game — cash out before a row fails' },
  { id: 'quest', label: 'Daily quest', how: 'v quest', weight: 3, desc: 'one daily objective pays out big; overrides reset each day' },
  { id: 'bounty', label: 'Weekly bounty', how: 'v bounty', weight: 2, desc: 'weekly objective with a fat reward, shares progress hooks with quests' },
  { id: 'checklist', label: 'Checklists', how: 'v checklist', weight: 2, desc: 'daily/weekly task lists paying coins AND seals' },
  { id: 'battlepass', label: 'Battle Pass', how: 'v battlepass', weight: 2, desc: '14-day seasonal track — xp from normal playing, premium costs 25 seals' },
  { id: 'vault', label: 'Vault', how: 'v vault deposit', weight: 2, desc: 'a per-guild savings pot only you can withdraw from — park coins away from impulse plays' },
  { id: 'blackmarket', label: 'Black Market', how: 'v blackmarket', weight: 2, desc: '4 rotating one-time slots refreshed every 6h' },
  { id: 'merchant', label: 'Travelling merchant', how: 'v merchant', weight: 1, desc: 'shows the current 3-slot stock when they are in town (~every 90 min)' },
  { id: 'crate', label: 'Crates', how: 'v crate', weight: 2, desc: 'misty rarity crates with a pity counter that climbs until you hit mythic' },
  { id: 'weapon', label: 'Pet weapons', how: 'v weapon list', weight: 3, desc: 'equip/upgrade weapons on team pets — great sword splash, poison DoT, taunting aegis and more' },
  { id: 'contract', label: 'Contracts', how: 'v contract', weight: 2, desc: 'stakes + objectives with auto-progress on your normal play' },
  { id: 'inbox', label: 'Inbox', how: 'v inbox', weight: 2, desc: 'deliveries land here — items, rewards and goodies waiting to be claimed' },
  { id: 'achievements', label: 'Achievements', how: 'v achievements', weight: 2, desc: 'auto-unlocked medals with coin/title rewards for your milestones' },
  { id: 'title', label: 'Titles', how: 'v title', weight: 1, desc: 'wear unlocked titles next to your name' },
  { id: 'setbadge', label: 'Badges', how: 'v setbadge', weight: 1, desc: 'customize how you appear to others' },
  { id: 'setlb', label: 'Leaderboard flair', how: 'v setlb', weight: 1, desc: 'leaderboard emblem customization' },
  { id: 'autoreact', label: 'Auto-react', how: 'v autoreact', weight: 1, desc: 'an emoji Gambot reacts with to your messages' },
  { id: 'customrole', label: 'Custom role', how: 'v customrole', weight: 1, desc: 'grab-a-color roles (or animated gradients)' },
  { id: 'marry', label: 'Marry', how: 'v marry @user', weight: 2, desc: 'getting married grants a shared money multiplier — retire once someday' },
  { id: 'family', label: 'Family', how: 'v family', weight: 1, desc: 'manage children and family perks' },
  { id: 'clan', label: 'Clans', how: 'v clan create', weight: 2, desc: 'player-owned clans you can join from any server' },
  { id: 'dex', label: 'Dex', how: 'v dex', weight: 2, desc: 'the full species checklist — completion feeds titles and bragging rights' },
  { id: 'zoo', label: 'Zoo', how: 'v zoo', weight: 1, desc: 'your whole collection at a glance' },
  { id: 'team', label: 'Team', how: 'v team', weight: 1, desc: 'battle team management' },
  { id: 'animal', label: 'Pet card', how: 'v animal <id>', weight: 2, desc: 'one pet in detail — bond tier, level, traits and stats' },
  { id: 'evolve', label: 'Evolution', how: 'v evolve <id>', weight: 2, desc: 'push a level 10+ pet into the next rarity with essence' },
  { id: 'sell', label: 'Sell', how: 'v sell <id|species|all>', weight: 2, desc: 'clear zoo clutter by id, species, rarity or everything at once' },
  { id: 'trade', label: 'Trade', how: 'v trade @user <id>', weight: 2, desc: 'trade pets player-to-player with a price' },
  { id: 'rep', label: 'Reputation', how: 'v rep @user', weight: 1, desc: 'hand out +rep — reputation is badge of honour, not currency' },
  { id: 'daily', label: 'Daily', how: 'v daily', weight: 2, desc: 'free coins, scaled down as your balance grows' },
  { id: 'weekly', label: 'Weekly', how: 'v weekly', weight: 1, desc: 'bigger free claim each week' },
  { id: 'streak', label: 'Streak', how: 'v streak', weight: 2, desc: 'daily logon bonus climbing to day 7 — resets if you idle 48h' },
  { id: 'work', label: 'Work', how: 'v work', weight: 2, desc: 'grind coins on a cooldown; rain events boost it' },
  { id: 'shop', label: 'Shop', how: 'v shop', weight: 2, desc: 'perks, crates and power-ups on a schedule' },
  { id: 'perkhelp', label: 'Perk help', how: 'v perkhelp', weight: 1, desc: 'what each perk actually does' },
  { id: 'gamehelp', label: 'Game help', how: 'v gamehelp <game>', weight: 1, desc: 'rules for every game, cards and tricks' },
  { id: 'event', label: 'Community events', how: 'v event', weight: 1, desc: 'rare rotating server events — button, roll call, creature sightings' },
  { id: 'summon', label: 'Summon settings', how: 'v summon', weight: 1, desc: 'control whether Gambot can ever DM you again after a long break' },
];

const lastRec = new Map(); // user -> { id, ts }

const run = (how) => `\`${how}\` — run it whenever, no rush.`;

function weightPick(arr) {
  const total = arr.reduce((t, f) => t + (f.weight || 1), 0);
  let roll = Math.random() * total;
  for (const f of arr) {
    roll -= (f.weight || 1);
    if (roll <= 0) return f;
  }
  return arr[arr.length - 1];
}

function buildContext(userId) {
  const u = db.ensureUser(userId) || {};
  const used = new Map();
  for (const id of FEATURES.map(f => f.id)) {
    const rec = db.getFeatureUse(userId, id);
    if (rec) used.set(id, rec);
  }
  const usedCount = used.size;
  const unseen = new Set(db.unseenFeatures(userId, FEATURES.map(f => f.id)));
  const owned = db.getOwnedSpecies(userId) || {};
  const speciesCount = Object.values(owned).reduce((n, l) => n + (l ? l.length : 0), 0);
  const speciesTotal = Object.values(db.SPECIES).reduce((n, list) => n + list.length, 0);

  let quest = null, bounty = null, deliveries = 0;
  try { const q = db.getQuest(userId); if (!q.claimed) quest = q; } catch {}
  try { const b = db.getBounty(userId); if (!b.claimed) bounty = b; } catch {}
  try { deliveries = db.getPendingDeliveryCount(userId); } catch {}

  // Pet progression: the pet closest to its next bond tier, plus anything ready to evolve.
  let animalsList = [];
  try { animalsList = db.getUserAnimals(userId); } catch {}
  let bondClosest = null;
  for (const a of animalsList) {
    const t = db.bondTier(a.bond || 0);
    if (t.next && (!bondClosest || t.toNext < bondClosest.toNext)) bondClosest = { pet: a, tier: t, toNext: t.toNext };
  }
  let evolvable = 0;
  for (const a of animalsList) { try { if (db.canEvolve(a).ok) evolvable++; } catch {} }

  // Dex milestone + merchant/summon opportunities.
  let dexP = null, dexMilestone = null;
  try { dexP = db.dexProgress(userId); dexMilestone = db.nextDexMilestone(dexP); } catch {}
  let merchantUnsold = 0;
  try { merchantUnsold = db.getMerchantItems().filter(i => !i.sold_to).length; } catch {}
  let summonOptOut = false;
  try { summonOptOut = !!db.getSummonOptOut(userId); } catch {}

  return {
    u, used, usedCount, unseen, owned, speciesCount, speciesTotal,
    quest, bounty, deliveries,
    eggs: u.eggs || 0,
    animals: db.getAnimalCount(userId),
    married: !!db.getMarriage(userId),
    clanName: (() => { try { const id = db.getClanOf(userId); return id ? (db.getClan(id) || {}).name : ''; } catch { return ''; } })(),
    event: db.getActiveCommunityEvent(),
    dexOwned: dexP ? dexP.owned : speciesCount,
    dexMilestone,
    bondClosest,
    evolvable,
    merchantUnsold,
    summonOptOut,
    summoned: u.summoned || 0,
  };
}

function buildRecommendations(ctx) {
  const out = [];
  const { used, unseen } = ctx;

  // MUST-ACT contextual (highest priority).
  if (ctx.quest) out.push({ f: FEATURES.find(f => f.id === 'quest'), line: `you have an unclaimed daily quest (${ctx.quest.progress}/${ctx.quest.target})` });
  if (ctx.bounty) out.push({ f: FEATURES.find(f => f.id === 'bounty'), line: `your weekly bounty (${ctx.bounty.progress}/${ctx.bounty.target}) is still unclaimed` });
  if (ctx.eggs > 0) out.push({ f: FEATURES.find(f => f.id === 'hatch'), line: `you have ${ctx.eggs} unhatched egg(s) doing nothing — pocket the payout instead` });
  if (ctx.deliveries > 0) out.push({ f: FEATURES.find(f => f.id === 'inbox'), line: `${ctx.deliveries} delivery(s) are waiting in your inbox` });

  // GAP context (next sensible step).
  if (ctx.speciesCount < ctx.speciesTotal) out.push({ f: FEATURES.find(f => f.id === 'dex'), line: `dex ${ctx.speciesCount}/${ctx.speciesTotal} — species still missing` });
  if (ctx.dexMilestone && ctx.dexMilestone.need - ctx.dexOwned > 0 && ctx.dexMilestone.need - ctx.dexOwned <= 5) {
    out.push({ f: FEATURES.find(f => f.id === 'dex'), line: `${ctx.dexMilestone.need - ctx.dexOwned} species from your next dex milestone (${ctx.dexMilestone.name})` });
  }
  if (ctx.animals > 0 && !used.has('battle')) out.push({ f: FEATURES.find(f => f.id === 'team'), line: 'you own pets but have not sent a battle team out yet' });
  if (ctx.bondClosest && ctx.bondClosest.toNext <= 60) {
    const pn = ctx.bondClosest.pet.name || ctx.bondClosest.pet.species;
    out.push({ f: FEATURES.find(f => f.id === 'animal'), line: `${pn} is only ${ctx.bondClosest.toNext} bond from ${ctx.bondClosest.tier.next.name} — feeding, leveling and battling all raise it` });
  }
  if (ctx.evolvable > 0) out.push({ f: FEATURES.find(f => f.id === 'evolve'), line: `${ctx.evolvable} pet(s) are level ${db.EVOLUTION_MIN_LEVEL}+ and ready to evolve` });
  if (ctx.merchantUnsold > 0) out.push({ f: FEATURES.find(f => f.id === 'merchant'), line: `the merchant still has ${ctx.merchantUnsold} unsold slot(s) available` });
  if (ctx.summonOptOut) out.push({ f: FEATURES.find(f => f.id === 'summon'), line: 'inactivity summons are switched off — `v summon` controls that' });
  if (!ctx.married) out.push({ f: FEATURES.find(f => f.id === 'marry'), line: 'unmarried in a marriage-multiplier economy' });
  if (!ctx.clanName) out.push({ f: FEATURES.find(f => f.id === 'clan'), line: 'no clan yet — one per player, joinable from any server' });
  if (ctx.event) out.push({ f: FEATURES.find(f => f.id === 'event'), line: `a community event is live right now (${ctx.event.key.replace(/_/g, ' ')})` });

  // NEVER-TRIED features (fresh ground).
  if (unseen.size) {
    const fresh = FEATURES.filter(f => unseen.has(f.id));
    out.push({ f: weightPick(fresh), line: 'you have never touched this feature in Gambot yet' });
  }

  // STALE features (used long ago).
  const now = Date.now() / 1000;
  const staleTargets = FEATURES.filter(f => {
    const rec = used.get(f.id);
    return rec && now - rec.last > 30 * 86400;
  });
  if (staleTargets.length) out.push({ f: weightPick(staleTargets), line: `you have not used this in a while (last ${Math.round((now - used.get(staleTargets[0].id).last) / 86400)}d ago)` });

  return out;
}

module.exports = {
  name: 'try',
  helpCategory: 'Info',
  helpArgs: '[tip|list]',
  description: 'recommend what you have not done yet in Gambot',
  aliases: ['suggest', 'todo'],
  buildContext,
  buildRecommendations,
  execute(message, args) {
    const uid = message.author.id;
    const mode = (args[0] || '').toLowerCase().trim();
    const ctx = buildContext(uid);

    if (mode === 'tip') {
      const pick = TIPS[Math.floor(Math.random() * TIPS.length)];
      return message.channel.send({ embeds: [embed('💡 Mechanic Tip (verified)', [['', `**${pick}**`]], 0x2b2d31)] });
    }

    if (mode === 'list') {
      const lines = FEATURES.map(f => `${ctx.unseen.has(f.id) ? '✨' : '✔️'} \`${ctx.used.get(f.id) ? `${f.id} (${ctx.used.get(f.id).count}x)` : f.id}\` — ${f.desc}`.slice(0, 1000));
      return message.channel.send({ embeds: [embed(`Feature tracker — ${ctx.usedCount}/${FEATURES.length} explored`, [['', `✨ = never tried · ✔️ = tried\n\n${lines.join('\n')}`]], 0x2b2d31)] });
    }

    const recs = buildRecommendations(ctx);
    if (!recs.length) {
      return message.channel.send({ embeds: [embed('🔍 v try', [['', 'you have explored basically everything on the big list. try `v try tip` for a mechanic refresher instead.']], 0x2b2d31)] });
    }
    const last = lastRec.get(uid);
    let choice = weightPick(recs);
    if (last && recs.length > 1) {
      for (let i = 0; i < 4 && choice && choice.f && choice.f.id === last.f.id; i++) {
        choice = weightPick(recs);
      }
    }
    if (choice && choice.f) {
      lastRec.set(uid, { id: choice.f.id, ts: Date.now() });
      message.channel.send({
        embeds: [embed('🔍 Gambot Recommends', [
          [choice.f.label, `${choice.line}.`],
          ['How', run(choice.f.how)],
          ['', choice.f.desc],
          ['progress', `${ctx.usedCount}/${FEATURES.length} features explored — \`v try list\` for the full tracker · \`v try tip\` for a mechanic refresher`],
        ], 0x57f287)],
      });
    } else {
      message.channel.send({ embeds: [embed('🔍 v try', [['', 'nothing stands out right now — maybe run `v try tip` and call it a day.']], 0x2b2d31)] });
    }
  },
};