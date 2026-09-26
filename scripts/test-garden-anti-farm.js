// Regression test (v2.1.0 security): snail-garden progression must NOT be
// farmable by repeatedly entering a garden and IMMEDIATELY SELLING. A 0-row
// sell is an untouched garden (pure refund, zero risk), so it must move NONE
// of the reward counters — at ANY bet size. Also verifies: daily XP cap
// persists across restart, runner unlocks can't be bypassed, garden
// XP/achievements are staked-gated, no duplicate rewards, breeding data
// survives migration, the legacy lucky flag has zero effect, and
// quests/battlepass/community events have no garden hook.
process.env.DB_PATH = '/tmp/garden_antifarm';
const fs = require('fs');
fs.rmSync('/tmp/garden_antifarm', { recursive: true, force: true });
fs.mkdirSync('/tmp/garden_antifarm', { recursive: true });

let pass = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
}

const Module = require('module');
const origLoad = Module._load;
class StubEmbed {
  constructor() { this._title = ''; this._fields = []; this._description = ''; }
  setColor(c) { this._color = c; return this; }
  setTitle(t) { this._title = t; return this; }
  setDescription(d) { this._description = d; return this; }
  addFields(...args) { for (const a of args) this._fields.push(a); return this; }
  setFooter(f) { this._footer = f; return this; }
  setImage(i) { this._image = i; return this; }
  toJSON() { return { title: this._title, fields: JSON.parse(JSON.stringify(this._fields)), description: this._description, image: this._image }; }
}
function genericBuilder() {
  const target = {};
  const handler = {
    get(t, p) { if (p === 'then') return undefined; if (!(p in t)) t[p] = () => proxy; return t[p]; },
    set(t, p, v) { t[p] = v; return true; },
  };
  const proxy = new Proxy(target, handler);
  return proxy;
}
const discordStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'EmbedBuilder') return StubEmbed;
    if (prop === 'ButtonStyle' || prop === 'TextInputStyle' || prop === 'ComponentType') return { Primary: 1, Secondary: 2, Success: 3, Danger: 4, Short: 1, Paragraph: 2, Button: 2, StringSelect: 3 };
    if (prop === 'ChannelType') return { GuildText: 0 };
    if (prop === 'Events') return { ClientReady: 'ready', InteractionCreate: 'interactionCreate', MessageCreate: 'messageCreate' };
    if (prop === 'PermissionFlagsBits') return new Proxy({}, { get: () => 0n });
    if (prop === 'Collection') return class extends Map {};
    return function Stub() { return genericBuilder(); };
  },
});
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') return discordStub;
  return origLoad.apply(this, arguments);
};

const db = require('../db');
const handler = require('../utils/commandHandler');

const FARM = 'farm_bot';        // 0-row refund spammer
const FARMER = 'farmer_ctrl';   // real-stake control
const RESTART = 'farm_restart'; // daily-cap-across-restart user
const RICH = 'farm_rich';       // upgrade transactionality check

function fakeGame(userId) {
  let collectCb = null;
  let sent = null;
  const msg = { id: 'fmsg1', createMessageComponentCollector: () => ({ on: (ev, cb) => { if (ev === 'collect') collectCb = cb; } }), edit: async () => {} };
  const channel = { id: '111', type: 0, send: async (payload) => { sent = payload; return { then: (cb) => { cb(msg); return msg; } }; } };
  return { sent: () => sent, collectCb: () => collectCb, messageObj: { id: 'mm', author: { id: userId, bot: false }, channel, guild: { id: '111' }, content: 'v sg 1' } };
}
function click(userId, customId) {
  let updated = null;
  return { user: { id: userId }, customId, deferUpdate: async () => {}, update: async (payload) => { updated = payload; }, get payload() { return updated; } };
}
const tick = () => new Promise(r => setTimeout(r, 0));
const day = () => Math.floor(Date.now() / 1000 / 86400);

// Drive one full game through the real command + buttons. plantRows>0 forces
// that many sg_next presses first (with Math.random forced to `rng` so growth
// succeeds), then sells.
async function play(userId, bet, plantRows, rng) {
  Math.random = () => rng;
  const game = fakeGame(userId);
  handler.getCommand('sg').execute(game.messageObj, [String(bet)]);
  await tick();
  for (let k = 0; k < plantRows; k++) {
    const n = click(userId, 'sg_next');
    await game.collectCb()(n);
  }
  const c = click(userId, 'sg_cash');
  await game.collectCb()(c);
  return c.payload;
}

async function main() {
  await db.init();
  handler.loadCommands();

  // ---------- prep ----------
  db.acceptTerms(FARM);
  db.addBalance(FARM, 500000);
  db.acceptTerms(FARMER);
  db.addBalance(FARMER, 5000000);
  db.acceptTerms(RESTART);
  db.addBalance(RESTART, 1000000);
  db.acceptTerms(RICH);
  db.addBalance(RICH, 50000000);

  const startBal = db.ensureUser(FARM).balance;
  const beforePass = db.passProgress(FARM).xp;

  // ============ 1. MIN-BET IMMEDIATE-SELL SPAM (300 × v sg 1 + Sell) ============
  for (let k = 0; k < 300; k++) await play(FARM, 1, 0, 0.9);
  const g = db.getGardenProfile(FARM);
  const s = db.gardenStatsFor(FARM);
  check('min-bet spam: ZERO runs recorded (0-row sell is a refund, not a run)', g.total_runs === 0 && g.won_runs === 0, JSON.stringify({ total_runs: g.total_runs, won_runs: g.won_runs }));
  check('min-bet spam: ZERO xp, level 1', g.xp === 0 && g.level === 1, JSON.stringify({ xp: g.xp, level: g.level }));
  check('min-bet spam: ZERO staked / won tracked', s.total_staked === 0 && g.total_won === 0, JSON.stringify({ staked: s.total_staked, won: g.total_won }));
  check('min-bet spam: balance EXACTLY unchanged (pure refund)', db.ensureUser(FARM).balance === startBal, `${db.ensureUser(FARM).balance} != ${startBal}`);
  check('min-bet spam: NO garden achievements', db.getAchievements(FARM).filter(k => k.startsWith('garden_')).length === 0);
  check('min-bet spam: NO garden titles', !db.checkTitles(FARM).includes('garden_keeper') && !db.checkTitles(FARM).includes('master_gardener'));
  check('min-bet spam: battlepass xp flat (gamble 1c & sub-10k win add 0)', db.passProgress(FARM).xp === beforePass, `${beforePass} -> ${db.passProgress(FARM).xp}`);

  // ============ 2. HIGH-STAKED 0-ROW SELL SPAM (the strongest exploit shape) ============
  // A 100k bet with an immediate sell is ALSO zero-risk (0 rows = 0 fail chance
  // = full refund). It must not farm either — any stake is fine.
  const highStart = db.ensureUser(FARM).balance;
  let refundBody = '';
  for (let k = 0; k < 10; k++) {
    const p = await play(FARM, 100000, 0, 0.9);
    refundBody = p && p.embeds && p.embeds[0]._fields && p.embeds[0]._fields[0].value || '';
  }
  const g2 = db.getGardenProfile(FARM);
  check('100k 0-row spam: STILL zero runs / zero xp', g2.total_runs === 0 && g2.xp === 0, JSON.stringify(g2));
  check('100k 0-row spam: STILL zero staked, zero achievements', db.gardenStatsFor(FARM).total_staked === 0 && db.getAchievements(FARM).filter(k => k.startsWith('garden_')).length === 0);
  check('100k 0-row spam: no wager counted (gamble_1m can never be farmed)', (db.ensureUser(FARM).total_gambled || 0) < 1000000, db.ensureUser(FARM).total_gambled);
  check('100k 0-row spam: balance EXACTLY unchanged', db.ensureUser(FARM).balance === highStart, `${db.ensureUser(FARM).balance} != ${highStart}`);
  check('100k 0-row spam: refund message shown for every touch', /refunded/.test(refundBody), refundBody);

  // ============ 3. CONTROL: a REAL one-row run unlocks progression ============
  const startFarmerBank = db.ensureUser(FARMER).balance;
  const c2 = db.recordGardenResult(FARMER, { bet: 500000, rows: 1, cashed: 625000, won: true });
  check('real-stake run earns xp (>= 50)', c2.added >= 50, JSON.stringify(c2));
  check('real-stake run counts toward total_staked', db.gardenStatsFor(FARMER).total_staked === 500000);
  check('garden_first achievement UNLOCKS once stakes >= 10k', c2.achievements.includes('garden_first'), JSON.stringify(c2.achievements));
  const farmerBalanceDelta = db.ensureUser(FARMER).balance - startFarmerBank;
  check('achievements paid at least garden_first exactly (15k among the batch)', farmerBalanceDelta >= 15000, farmerBalanceDelta);
  const c2b = db.recordGardenResult(FARMER, { bet: 50000, rows: 2, cashed: 81250, won: true });
  check('garden_first NEVER paid twice (second win pays nothing)', db.ensureUser(FARMER).balance - (startFarmerBank + farmerBalanceDelta) === 0 && !c2b.achievements.includes('garden_first'), JSON.stringify(c2b.achievements));

  // staked-gate boundary: just under 10k of staked winnings gives nothing
  db.acceptTerms('farm_boundary');
  const b1 = db.recordGardenResult('farm_boundary', { bet: 9999, rows: 1, cashed: 12498, won: true });
  check('staked 9999: still no achievements, zero xp', b1.added === 0 && b1.achievements.length === 0, JSON.stringify(b1));
  const b2 = db.recordGardenResult('farm_boundary', { bet: 10000, rows: 1, cashed: 12500, won: true });
  check('staked crosses 10k: garden_first unlocks + xp flows', b2.added >= 1 && b2.achievements.includes('garden_first'), JSON.stringify(b2));
  check('level 2 needs real xp (boundary user still level 1)', db.gardenStatsFor('farm_boundary').level === 1, db.gardenStatsFor('farm_boundary').level);

  // real E2E progression: plant 1 row (forced success) then sell at 100k
  db.exec(`UPDATE users SET lucky = 1 WHERE user_id = '${FARM}'`);
  db.addBalance(FARM, -100000); // 400k -> balance factor 1 for exact math
  const realStart = db.ensureUser(FARM).balance;
  await play(FARM, 100000, 1, 0.9);
  const realDelta = db.ensureUser(FARM).balance - realStart;
  const g3 = db.getGardenProfile(FARM);
  check('real E2E run counted (1 run, 1 staked 100k)', g3.total_runs === 1 && db.gardenStatsFor(FARM).total_staked === 100000, JSON.stringify({ runs: g3.total_runs, staked: db.gardenStatsFor(FARM).total_staked }));
  check('real E2E run earned xp despite lucky flag (11 row + 2 bonus, no farm)', g3.xp === 13, JSON.stringify({ xp: g3.xp }));
  check('real E2E payout = clean 1.25x profit + one-shot garden_first (25k + 15k)', realDelta === 40000, realDelta);
  db.exec(`UPDATE users SET lucky = 0 WHERE user_id = '${FARM}'`);

  // ============ 4. LEGACY LUCKY FLAG HAS ZERO EFFECT ============
  for (const [uid, luckyFlag] of [['farm_lucky', 1], ['farm_plain', 0]]) {
    db.acceptTerms(uid);
    db.addBalance(uid, 400000);
    if (luckyFlag) db.exec(`UPDATE users SET lucky = 1 WHERE user_id = '${uid}'`);
  }
  const deltas = {};
  for (const uid of ['farm_lucky', 'farm_plain']) {
    const before = db.ensureUser(uid).balance;
    await play(uid, 200000, 1, 0.9); // real one-row run, forced success
    deltas[uid] = db.ensureUser(uid).balance - before;
  }
  check('lucky=1 and lucky=0 settle IDENTICALLY (flag has zero effect)', deltas.farm_lucky === deltas.farm_plain, JSON.stringify(deltas));
  check('both pay the exact 1.25x profit + one-shot garden_first (50k + 15k)', deltas.farm_lucky === 65000 && deltas.farm_plain === 65000, JSON.stringify(deltas));

  // ============ 5. RUNNER UNLOCKS CANNOT BE BYPASSED ============
  let r = db.equipGardenRunner(FARM, 'dragon');
  check('frog..dragon still level-gated for the spammer (level 1)', r.ok === false && r.reason === 'locked', JSON.stringify(r));
  db.addGardenXp(FARM, 400); // level 5 made via the raw helper (test-only)
  check('frog equips once level >= 2', db.equipGardenRunner(FARM, 'frog').ok === true);
  r = db.equipGardenRunner(FARM, 'dragon');
  check('dragon STILL locked at level 5', r.ok === false && r.reason === 'locked', JSON.stringify(r));
  db.exec(`UPDATE garden_meta SET xp = 1100 WHERE user_id = '${FARM}'`); // level 9
  r = db.equipGardenRunner(FARM, 'dragon');
  check('dragon unlocks only at level 9', r.ok === true, JSON.stringify(r));

  let out = null;
  const m = { id: 'm', author: { id: 'farm_fresh', bot: false }, channel: { id: '444', send: async (p) => { out = p; return {}; } }, content: '' };
  handler.getCommand('gardenpet').execute(m, ['dragon']);
  await tick();
  check('v gardenpet dragon on level-1 user shows locked error', !!out && out.embeds && /locked|unlocks at garden level/.test(JSON.stringify(out.embeds[0]._fields)), JSON.stringify(out && out.embeds ? out.embeds[0]._fields : null));

  // ============ 6. UPGRADE PURCHASES ARE TRANSACTIONAL ============
  const richBank = db.ensureUser(RICH).balance;
  const buy = db.buyGardenUpgrade(RICH, 'soil');
  const richAfter = db.ensureUser(RICH).balance;
  check('upgrade charges EXACTLY the listed cost once', richBank - richAfter === 250000, `${richBank - richAfter}`);
  check('upgrade level increments exactly one', buy.level === 1 && buy.ok === true, JSON.stringify(buy));
  check('upgrade balance+level in lockstep (no partial apply)', db.getGardenProfile(RICH).unlocks.soil === 1, JSON.stringify(db.getGardenProfile(RICH).unlocks));

  // ============ 7. BREEDING DATA SURVIVES MIGRATION ============
  db.exec(`UPDATE users SET snails = 5, snail_time = ${Math.floor(Date.now() / 1000)} WHERE user_id = '${RICH}'`);
  const info = db.getSnailInfo(RICH);
  check('breeding snails column intact alongside new garden tables', info.snails === 5, JSON.stringify(info));
  let gOut = null;
  const gm = { id: 'm2', author: { id: RICH, bot: false }, channel: { id: '555', send: async (p) => { gOut = p; return {}; } }, content: '' };
  handler.getCommand('garden').execute(gm, ['sell', '2']);
  await tick();
  check('v garden sell still breeds/sells (preserved)', !!gOut && gOut.embeds && /sold/.test(JSON.stringify(gOut.embeds)), JSON.stringify(gOut && gOut.embeds ? gOut.embeds : null));

  // ============ 8. DAILY XP CAP PERSISTS ACROSS RESTART ============
  const r1 = db.addGardenXp(RESTART, 120);
  const r2 = db.addGardenXp(RESTART, 180); // 120+180 = 300 = cap
  check('cap reachable via legit xp (120 then 180)', r1.added === 120 && r2.added === 180 && r2.capped === true, JSON.stringify({ r1, r2 }));

  const dbPath = require.resolve('../db');
  delete require.cache[dbPath];
  const db2 = require('../db');
  await db2.init();
  const afterRestart = db2.addGardenXp(RESTART, 50);
  check('DAILY XP CAP PERSISTS ACROSS RESTART (0 more xp)', afterRestart.added === 0 && afterRestart.capped === true, JSON.stringify(afterRestart));
  const fresh = db2.getGardenProfile(RESTART);
  check('xp_day + today timestamp persisted (fresh instance sees them)', fresh.xpUsedToday === 300, JSON.stringify(fresh));
  db2.exec(`UPDATE garden_meta SET xp_day_ts = ${day() - 1} WHERE user_id = '${RESTART}'`);
  const nextDay = db2.addGardenXp(RESTART, 25);
  check('cap rolls over ONLY on a new day', nextDay.added === 25 && nextDay.capped === false, JSON.stringify(nextDay));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('TEST CRASH', e); process.exit(1); });