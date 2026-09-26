// Regression test: Snail Garden progression (v2.1.0) — deterministic.
// Covers: level/xp + daily cap, runner unlock/equip + EV safety invariant,
// upgrade buy/max/insufficient/exactly-once/level-gating, deep-row gating of
// effects, safety net counters, run stats, achievements, titles, and end-to-end
// command wiring (v sg alias, cash-out/fail flows, event gating).
process.env.DB_PATH = '/tmp/garden_test';
const fs = require('fs');
fs.rmSync('/tmp/garden_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/garden_test', { recursive: true });

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

const U = 'garden_main';
const U2 = 'garden_rich';

function fakeGame(userId) {
  let collectCb = null;
  let sent = null;
  const msg = {
    id: 'gmsg1',
    createMessageComponentCollector: () => ({ on: (ev, cb) => { if (ev === 'collect') collectCb = cb; } }),
    edit: async () => {},
  };
  const channel = {
    id: '111',
    type: 0,
    send: async (payload) => { sent = payload; return { then: (cb) => { cb(msg); return msg; } }; },
  };
  return {
    sent: () => sent,
    collectCb: () => collectCb,
    messageObj: { id: 'mm', author: { id: userId, bot: false }, channel, guild: { id: '111' }, content: 'v sg 1000' },
  };
}
function click(userId, customId) {
  let updated = null;
  return {
    user: { id: userId }, customId,
    deferUpdate: async () => {},
    update: async (payload) => { updated = payload; },
    get payload() { return updated; },
  };
}
const tick = () => new Promise(r => setTimeout(r, 0));
const day = () => Math.floor(Date.now() / 1000 / 86400);

async function main() {
  await db.init();
  handler.loadCommands();

  // ---------- command registration + aliases ----------
  const sg = handler.getCommand('sg');
  check('`sg` alias resolves to snailgarden', !!sg && sg.name === 'snailgarden');
  check('snailgarden has helpCategory + description', !!sg.helpCategory && !!sg.description);
  const gp = handler.getCommand('gardenpet');
  const gs = handler.getCommand('gardenshop');
  const gb = handler.getCommand('gardenbuy');
  check('gardenpet registered + gp alias', !!gp && gp.aliases.includes('gp') && !!gp.description);
  check('gardenshop registered + gshop alias', !!gs && gs.aliases.includes('gshop') && !!gs.description);
  check('gardenbuy registered + gbuy alias', !!gb && gb.aliases.includes('gbuy') && !!gb.description);
  const garden = handler.getCommand('garden');
  check('garden still registered (breeding preserved via snails alias)', !!garden && garden.aliases.includes('snails'));

  // ---------- level / xp formula ----------
  check('level 1 at 0 xp', db.gardenLevelFor(0) === 1);
  check('level 1 at 112 xp', db.gardenLevelFor(112) === 1);
  check('level 2 at 113 xp', db.gardenLevelFor(113) === 2);
  check('level 5 at 447 xp', db.gardenLevelFor(447) === 5, db.gardenLevelFor(447));
  check('level 9 at 1080 xp', db.gardenLevelFor(1080) === 9);
  check('level 10 at 1265 xp', db.gardenLevelFor(1265) === 10);
  check('xpxToLevel2 = 113', db.gardenXpForLevel(2) === 113);

  db.acceptTerms(U);
  db.acceptTerms(U2);
  db.addBalance(U2, 999999999);

  // ---------- fresh profile ----------
  const g0 = db.getGardenProfile(U);
  check('fresh profile: level 1, snail, zero stats', g0.level === 1 && g0.runner === 'snail' && g0.total_runs === 0 && g0.won_runs === 0, JSON.stringify(g0));
  const stats0 = db.gardenStatsFor('no_meta_user');
  check('gardenStatsFor absent user = zeros, no insert', stats0.total_runs === 0 && stats0.level === 1);

  // ---------- XP + daily cap ----------
  const xp1 = db.addGardenXp(U, 120);
  check('xp added = 120, leveled to 2', xp1.added === 120 && xp1.level === 2 && xp1.leveledUp === true, JSON.stringify(xp1));
  check('level-up pays level*5000 coins', db.ensureUser(U).balance >= 10000, db.ensureUser(U).balance);
  db.exec(`UPDATE garden_meta SET xp_day = ${db.GARDEN_XP_DAY_CAP}, xp_day_ts = ${day()} WHERE user_id = 'garden_main'`);
  const blocked = db.addGardenXp(U, 50);
  check('daily xp cap blocks further gains', blocked.added === 0 && blocked.capped === true, JSON.stringify(blocked));
  db.exec(`UPDATE garden_meta SET xp_day_ts = ${day() - 1} WHERE user_id = 'garden_main'`);
  const afterRoll = db.addGardenXp(U, 30);
  check('cap resets next day', afterRoll.added === 30 && afterRoll.capped === false, JSON.stringify(afterRoll));

  // ---------- runner gating ----------
  let eq = db.equipGardenRunner(U, 'frog');
  check('frog equips at level 2', eq.ok === true, JSON.stringify(eq));
  db.exec(`UPDATE garden_meta SET runner = 'snail' WHERE user_id = 'garden_main'`);
  db.addGardenXp(U, 400); // xp 150 -> 550 -> level 5
  eq = db.equipGardenRunner(U, 'cat');
  check('cat equips at level >= 3', eq.ok === true, JSON.stringify(eq));
  eq = db.equipGardenRunner(U, 'dragon');
  check('dragon still locked at level 5', eq.ok === false && eq.reason === 'locked', JSON.stringify(eq));

  // ---------- EV safety invariant ----------
  let evOk = true, evBad = [];
  for (const [k, r] of Object.entries(db.GARDEN_RUNNERS)) {
    const ratio = (1 - r.failBase / 100) * r.mult;
    if (ratio > 1.000001) { evOk = false; evBad.push(`${k}=${ratio.toFixed(4)}`); }
  }
  check('every runner: (1-failBase/100)*mult <= 1.0 (never +EV)', evOk, evBad.join(' '));
  check('runner count = 9', Object.keys(db.GARDEN_RUNNERS).length === 9);

  // ---------- upgrades: buy / cost / max / gating / exactly-once ----------
  let soil1 = db.buyGardenUpgrade(U2, 'soil');
  check('soil buy lvl1 ok, cost 250k', soil1.ok === true && soil1.level === 1 && soil1.cost === 250000, JSON.stringify(soil1));
  const bal0 = db.ensureUser(U2).balance;
  const soil2 = db.buyGardenUpgrade(U2, 'soil');
  const bal1 = db.ensureUser(U2).balance;
  check('soil lvl2 costs exactly 500k', bal0 - bal1 === 500000, `${bal0 - bal1}`);
  check('exactly-once: soil went 1 -> 2', soil2.level === 2 && soil2.ok === true);
  for (let i = 0; i < 3; i++) db.buyGardenUpgrade(U2, 'soil'); // -> 3,4,5
  const soilMax = db.buyGardenUpgrade(U2, 'soil');
  check('soil caps at maxLevel 5', soilMax.ok === false && soilMax.reason === 'max', JSON.stringify(soilMax));

  const canL1 = db.buyGardenUpgrade(U2, 'can');
  check('golden can gated by level 6', canL1.ok === false && canL1.reason === 'level', JSON.stringify(canL1));
  for (let i = 0; i < 3; i++) db.buyGardenUpgrade(U2, 'boots'); // -> 1,2,3
  const boots3 = db.buyGardenUpgrade(U2, 'boots');
  check('boots caps at maxLevel 3', boots3.ok === false && boots3.reason === 'max', JSON.stringify(boots3));

  // level-gating: a funded fresh user still can't buy level-gated items
  db.acceptTerms('garden_fresh');
  db.addBalance('garden_fresh', 100000000);
  const gatedCan = db.buyGardenUpgrade('garden_fresh', 'can');
  check('upgrades level-gated for a fresh user (can needs 6)', gatedCan.ok === false && gatedCan.reason === 'level', JSON.stringify(gatedCan));
  db.addGardenXp(U2, 150); // level 2
  const seed1 = db.buyGardenUpgrade(U2, 'seeds');
  check('seeds buyable at level 2', seed1.ok === true && seed1.level === 1, JSON.stringify(seed1));

  const poorBuy = db.buyGardenUpgrade(U, 'net'); // level ok, no coins
  check('net sale fails on insufficient coins', poorBuy.ok === false && poorBuy.reason === 'coins', JSON.stringify(poorBuy));

  // ---------- deep-row gating ----------
  const mods = db.gardenMods(U2); // soil 5, seeds 1, boots 3
  check('boots raise maxSteps 10 -> 13', mods.maxSteps === 13, mods.maxSteps);
  check('soil does NOT touch first-row fail', db.gardenFailAt(mods, 0) === 20, db.gardenFailAt(mods, 0));
  check('soil DOES reduce deep-row fail (row 5)', db.gardenFailAt(mods, 5) < 55, db.gardenFailAt(mods, 5));
  check('upgrades do NOT touch first-row growth', Math.abs(db.gardenRowGrowth(mods, 0) - 1.25) < 0.001, db.gardenRowGrowth(mods, 0));
  check('upgrades DO boost deep-row growth', db.gardenRowGrowth(mods, 5) > 1.25, db.gardenRowGrowth(mods, 5));
  const snailMods = { mult: 1.25, failBase: 20, failStep: 7, deepDepth: 5, soil: 0, seeds: 0, can: 0 };
  check('multAt(0) = 1', db.gardenMultAt(snailMods, 0) === 1);
  check('snail 10 rows = 9.31x', Math.abs(db.gardenMultAt(snailMods, 10) - 9.31) < 0.01, db.gardenMultAt(snailMods, 10));
  const snail13 = db.gardenMultAt(snailMods, 13);
  check('snail 13 rows (boots max) > 10 rows', snail13 > db.gardenMultAt(snailMods, 10), snail13);

  // ---------- events gating ----------
  const origRandom = Math.random;
  Math.random = () => 0.0; // always "rolls"
  check('events never trigger on shallow rows', db.gardenEvent(0) === null);
  check('events do trigger on deep rows', !!db.gardenEvent(5));
  Math.random = () => 0.9; // 0.9 > 0.12 rare threshold
  check('events rare on deep rows', db.gardenEvent(5) === null);
  Math.random = origRandom;

  // ---------- recordGardenResult: stats + achievements ----------
  db.exec(`UPDATE garden_meta SET xp_day = 0, xp_day_ts = 0 WHERE user_id = 'garden_main'`); // free the daily cap for the run tests
  const rec1 = db.recordGardenResult(U, { bet: 10000, rows: 3, cashed: 19530, won: true });
  let gp1 = db.getGardenProfile(U);
  check('won run recorded (runs/won/best/total_won)', gp1.total_runs === 1 && gp1.won_runs === 1 && gp1.best_run === 3 && gp1.total_won === 19530, JSON.stringify(gp1));
  check('won run earns xp', rec1.added >= 3, JSON.stringify(rec1));
  check('garden_first achievement after first win', rec1.achievements.includes('garden_first'), JSON.stringify(rec1.achievements));
  const rec2 = db.recordGardenResult(U, { bet: 10000, rows: 5, cashed: 0, won: false, catches: 1 });
  gp1 = db.getGardenProfile(U);
  check('lost run: total_lost += bet, catches = 1', gp1.total_lost === 10000 && gp1.safety_catches === 1, JSON.stringify(gp1));
  check('garden_safety achievement after a catch', rec2.achievements.includes('garden_safety'), JSON.stringify(rec2.achievements));

  const rec3 = db.recordGardenResult(U, { bet: 100000, rows: 10, cashed: 931000, won: true });
  gp1 = db.getGardenProfile(U);
  check('best run reached 10 (perfect garden)', gp1.best_run === 10);
  check('garden_perfect achievement unlocked', rec3.achievements.includes('garden_perfect'), JSON.stringify(rec3.achievements));

  // ---------- titles ----------
  db.exec(`UPDATE garden_meta SET xp = 500, xp_day = 1, xp_day_ts = 0 WHERE user_id = 'garden_main'`);
  check('garden_keeper title at level 5', db.checkTitles(U).includes('garden_keeper'), JSON.stringify(db.checkTitles(U)));
  db.exec(`UPDATE garden_meta SET xp = 1300 WHERE user_id = 'garden_main'`);
  check('master_gardener title at level 10', db.checkTitles(U).includes('master_gardener'), JSON.stringify(db.checkTitles(U)));

  // ---------- E2E: start / sell / fail / multi-row ----------
  const plugin = (r) => { Math.random = r; };
  const cmd = handler.getCommand('sg');

  // run A: one-row sprint then sell (an untouched 0-row sell is a refund, not a run)
  const a = fakeGame(U);
  plugin(() => 0.9);
  cmd.execute(a.messageObj, ['1000']);
  await tick();
  check('v sg starts a run with an embed', !!a.sent() && a.sent().embeds.length === 1);
  const na = click(U, 'sg_next');
  await a.collectCb()(na);
  const ca = click(U, 'sg_cash');
  await a.collectCb()(ca);
  const aBody = ca.payload && ca.payload.embeds[0]._fields[0].value;
  check('one-row sprint sells (Sold line)', !!aBody && /Sold the garden/.test(aBody), aBody);

  // run B: fail first row
  const b = fakeGame(U);
  plugin(() => 0.0); // 0 < 20 fail%
  cmd.execute(b.messageObj, ['1000']);
  await tick();
  const cb = click(U, 'sg_next');
  await b.collectCb()(cb);
  const bBody = cb.payload && cb.payload.embeds[0]._fields[0].value;
  check('first-row fail shows loss line', !!bBody && /failed/.test(bBody), bBody);

  // run C: plant 2 rows then sell
  const c = fakeGame(U);
  plugin(() => 0.9);
  cmd.execute(c.messageObj, ['1000']);
  await tick();
  for (let k = 0; k < 2; k++) { const n = click(U, 'sg_next'); await c.collectCb()(n); }
  const cc = click(U, 'sg_cash');
  await c.collectCb()(cc);
  const cBody = cc.payload && cc.payload.embeds[0]._fields[0].value;
  check('2-row garden sells (Steps 2/10)', !!cBody && cBody.includes('Steps: `2/10`'), cBody);
  const cG = db.getGardenProfile(U);
  check('E2E runs recorded in stats (3 db + 3 e2e)', cG.total_runs === 6, JSON.stringify(cG));

  // ---------- command renders ----------
  for (const [name, argsArr, user] of [
    ['gardenpet', [], U], ['gardenpet', ['cat'], U], ['gardenpet', ['nope'], U],
    ['gardenshop', [], U2], ['gardenbuy', ['soil'], U2], ['gardenbuy', ['nope'], U2],
    ['garden', [], U], ['garden', ['buy', '2'], U], ['garden', ['sell', '1'], U],
  ]) {
    const c2 = handler.getCommand(name);
    let out = null;
    const m = { id: 'x', author: { id: user, bot: false }, channel: { id: '333', send: async (p) => { out = p; return {}; } }, content: '' };
    try { c2.execute(m, argsArr); await tick(); } catch (e) { out = { err: e }; }
    check(`render ${name} ${argsArr.join(' ')}`, !!out && out.embeds && !out.err, out && (out.err ? out.err.message : JSON.stringify(out.embeds && out.embeds[0])));
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('TEST CRASH', e); process.exit(1); });