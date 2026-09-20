// Regression test for the crash payout bug (2.0.3): the leftover "lucky" branch
// in commands/crash.js forced crashPoint = target+10+rnd*20 (guaranteed win) and
// multiplied payouts by 3 (payouts = amount * target * 3). All three live rounds
// traced to EXACTLY that formula:
//   6,414,231 * 1.2 * 3 = 23,091,231   23,091,231 * 2.4 * 3 = 166,256,863
//   166,256,863 * 5.2 * 3 = 2,593,607,062
// Expected (pure fair): payout = floor(amount * target), no lucky branch,
// no forced crash point, no 3x. Drives the real command through the real handler.
// NOTE: fresh test users auto-unlock achievements on their first win (+balance),
// so we assert the REAL payout via the reply text and via total_won (which only
// payWin touches), never via raw balance.
process.env.DB_PATH = '/tmp/crash_it';
const fs = require('fs');
fs.rmSync('/tmp/crash_it', { recursive: true, force: true });
fs.mkdirSync('/tmp/crash_it', { recursive: true });

const Module = require('module');
const origLoad = Module._load;
function stubInstance() {
  const target = {};
  const handler = {
    get(t, p) {
      if (p === 'then') return undefined;
      if (!(p in t)) t[p] = () => proxy;
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; },
  };
  const proxy = new Proxy(target, handler);
  return proxy;
}
const discordStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'ButtonStyle') return { Primary: 1, Secondary: 2, Success: 3, Danger: 4 };
    if (prop === 'TextInputStyle') return { Short: 1, Paragraph: 2 };
    if (prop === 'ChannelType') return { GuildText: 0 };
    if (prop === 'ComponentType') return { Button: 2, StringSelect: 3 };
    if (prop === 'Events') return { ClientReady: 'ready', InteractionCreate: 'interactionCreate', MessageCreate: 'messageCreate' };
    if (prop === 'PermissionFlagsBits') return new Proxy({}, { get: () => 0n });
    if (prop === 'Collection') return class extends Map {};
    return function Stub() { return stubInstance(); };
  },
});
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') return discordStub;
  return origLoad.apply(this, arguments);
};

const assert = require('assert');
const db = require('../db');
const handler = require('../utils/commandHandler');
const cooldowns = require('../utils/cooldowns');
const { DEFAULTS } = cooldowns;

let seq = 0;
const uid = () => 'crash_it_' + (++seq);
const OWNER = '536278876247162882';

function makeMessage(content, userId) {
  const sends = [];
  const channel = {
    id: 'chan_it',
    send(payload) {
      sends.push(payload);
      return Promise.resolve({ delete: () => Promise.resolve(), edit: () => Promise.resolve() });
    },
  };
  return { content, author: { id: userId, bot: false }, guild: { id: 'guild_it' }, channel, _sends: sends };
}
function crashReply(msg) {
  for (const s of msg._sends) if (typeof s === 'string' && s.includes('📈')) return s;
  return null;
}
function errorReply(msg) {
  for (const s of msg._sends) {
    if (s && s.embeds && s.embeds[0]) {
      const e = s.embeds[0];
      const desc = (e.data && e.data.description) || e.description || '';
      if (desc) return desc;
      if (e.fields && e.fields[0]) return String(e.fields[0].value || '');
      if (e.data && e.data.fields && e.data.fields[0]) return String(e.data.fields[0].value || '');
    }
  }
  return null;
}

async function run(input, id) {
  const msg = makeMessage(input, id);
  await handler.handleMessage(msg);
  return { msg, reply: crashReply(msg), err: errorReply(msg) };
}

async function runFresh(input) {
  const id = uid();
  db.acceptTerms(id); // balance 1000, factor 1
  const wonBefore = db.ensureUser(id).total_won || 0;
  const r = await run(input, id);
  return { id, ...r, wonBefore, won: (db.ensureUser(id).total_won || 0) - wonBefore };
}

(async () => {
  await db.init();
  handler.loadCommands();

  const results = [];
  const check = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  const realRandom = Math.random;
  async function forced(input, rand) {
    Math.random = () => rand;
    try { return await runFresh(input); } finally { Math.random = realRandom; }
  }
  // crash is on a 3s in-memory cooldown: consecutive runs from the SAME userId get
  // blocked, so separate owner-round / no-stale-state assertions must wait it out.
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  // ---- 1. PARSER / docs ----
  console.log('== PARSER ==');
  let r = await runFresh('v crash 100 1.2');
  check('v crash <amount> <mult> runs (100 @ 1.2x)', r.reply !== null, r.reply);

  r = await runFresh('v crsh 100 1.1');
  check('alias crsh works', r.reply !== null, r.reply);

  r = await runFresh('v crash 1.2');
  check('v crash <mult-only> is rejected (needs <amount> <mult>) -> no settle', r.reply === null, r.reply || 'no crash reply (good)');

  // ---- 2. FIXED-RNG WIN CASES (pure fair, no 3x) ----
  console.log('== WIN PAYOUTS (pure fair) ==');
  r = await forced('v crash 100 1.2', 0.9);  // crashPoint 9.9 -> win
  check('100 @ 1.2x WIN -> payout gross 120, profit +20 (not +60/+360)', /for \*\*120\*\* \(\+\*\*20\*\*\)/.test(r.reply || ''), r.reply);
  check('  total_won += exactly 20', r.won === 20, `wonDelta=${r.won}`);

  r = await forced('v crash 100 2  ', 0.9);
  check('100 @ 2x WIN -> gross 200, +100 (not +300)', /for \*\*200\*\* \(\+\*\*100\*\*\)/.test(r.reply || ''), r.reply);
  check('  total_won += exactly 100', r.won === 100, `wonDelta=${r.won}`);

  r = await forced('v crash 100 5.2', 0.9);
  check('100 @ 5.2x WIN -> gross 520, +420 (not +1260)', /for \*\*520\*\* \(\+\*\*420\*\*\)/.test(r.reply || ''), r.reply);
  check('  total_won += exactly 420', r.won === 420, `wonDelta=${r.won}`);

  // ---- 3. LOSS (crash before target) ----
  console.log('== LOSS (crash before target) ==');
  r = await forced('v crash 100 2', 0.34); // crashPoint = 0.99/0.66 = 1.5 < 2
  check('100 @ 2x, crash at 1.5x -> LOST 100 (no forced win)', /lost \*\*100\*\*/.test(r.reply || ''), r.reply);
  check('  total_won unchanged on loss', r.won === 0, `wonDelta=${r.won}`);

  // ---- 4. `all` at the exact reported live balances (owner factor 1) ----
  console.log('== ALL at reported live balances (owner) ==');
  {
    const id = OWNER;
    // Owner fresh in this DB: achievements unlock on first win and add balance,
    // so setBalance right before EACH round to keep the start amount exact.
    db.acceptTerms(id); db.setBalance(id, 6_414_231);
    let bal0 = db.getBalance(id);
    let wonBefore = db.ensureUser(id).total_won || 0;
    Math.random = () => 0.9;
    r = await run('v crash all 1.2', id);
    Math.random = realRandom;
    let won = (db.ensureUser(id).total_won || 0) - wonBefore;
    let expectGross = Math.floor(bal0 * 1.2);
    let expectNet = expectGross - bal0;
    check('6,414,231 @ all 1.2x -> gross 7,697,077, +1,282,846 (NOT 23,091,231)', /for \*\*7697077\*\* \(\+\*\*1282846\*\*\)/.test(r.reply || ''), r.reply);
    check('  total_won += exactly 1,282,846', won === expectNet, `won=${won} expect=${expectNet}`);

    db.setBalance(id, expectGross); // 7,697,077 (ignore achievement bumps)
    bal0 = db.getBalance(id);
    wonBefore = db.ensureUser(id).total_won || 0;
    await sleep(3100);
    Math.random = () => 0.9;
    r = await run('v crash all 2.4', id);
    Math.random = realRandom;
    won = (db.ensureUser(id).total_won || 0) - wonBefore;
    expectGross = Math.floor(bal0 * 2.4);
    expectNet = expectGross - bal0;
    check('7,697,077 @ all 2.4x -> gross 18,472,984, +10,775,907 (NOT 3x)', /for \*\*18472984\*\* \(\+\*\*10775907\*\*\)/.test(r.reply || ''), r.reply);
    check('  total_won += exactly 10,775,907', won === 10_775_907, `won=${won} expect=${expectNet}`);

    db.setBalance(id, expectGross); // 18,472,985
    bal0 = db.getBalance(id);
    wonBefore = db.ensureUser(id).total_won || 0;
    await sleep(3100);
    Math.random = () => 0.9;
    r = await run('v crash all 5.2', id);
    Math.random = realRandom;
    won = (db.ensureUser(id).total_won || 0) - wonBefore;
    expectGross = Math.floor(bal0 * 5.2);
    expectNet = expectGross - bal0;
    check('18,472,984 @ all 5.2x -> gross 96,059,516, +77,586,532 (NOT 3x)', /for \*\*96059516\*\* \(\+\*\*77586532\*\*\)/.test(r.reply || ''), r.reply);
    check('  total_won += exactly 77,586,532', won === 77_586_532, `won=${won} expect=${expectNet}`);
  }

  // ---- 5. LUCKY ON must be ignored (no 3x, no forced win) ----
  console.log('== LUCKY TOGGLE IS DEAD (crash pure fair) ==');
  {
    const id = uid();
    db.acceptTerms(id); db.toggleLucky(id); // lucky ON
    let wonBefore = db.ensureUser(id).total_won || 0;
    Math.random = () => 0.9; // crash 9.9
    r = await run('v crash 100 2', id);
    Math.random = realRandom;
    let won = (db.ensureUser(id).total_won || 0) - wonBefore;
    check('lucky ON + crash 9.9 >= 2x -> WIN even money +100 (NOT +300)', /for \*\*200\*\* \(\+\*\*100\*\*\)/.test(r.reply || ''), r.reply);
    check('  total_won += 100 despite lucky', won === 100, `wonDelta=${won}`);
  }
  {
    const id = uid();
    db.acceptTerms(id); db.toggleLucky(id);
    Math.random = () => 0.34; // crashPoint 1.5 < 2
    r = await run('v crash 100 2', id);
    Math.random = realRandom;
    check('lucky ON + crash 1.5 < 2x -> still LOST 100 (no forced win)', /lost \*\*100\*\*/.test(r.reply || ''), r.reply);
  }

  // ---- 6. STATS: no double-credit via gambled ----
  console.log('== STATS / no double-credit ==');
  {
    const id = uid();
    db.acceptTerms(id);
    const b2 = db.ensureUser(id);
    Math.random = () => 0.34;
    r = await run('v crash 100 2', id);
    Math.random = realRandom;
    const a2 = db.ensureUser(id);
    check('loss: total_gambled += exactly 100, total_won unchanged', (a2.total_gambled || 0) === (b2.total_gambled || 0) + 100 && (a2.total_won || 0) === (b2.total_won || 0), `gambleDelta=${(a2.total_gambled||0)-(b2.total_gambled||0)} wonDelta=${(a2.total_won||0)-(b2.total_won||0)}`);
  }

  // ---- 7. NO STALE STATE (two consecutive wins both fully resolve) ----
  console.log('== NO STALE STATE ==');
  {
    const id = uid();
    db.acceptTerms(id);
    const w0 = db.ensureUser(id).total_won || 0;
    Math.random = () => 0.9;
    await run('v crash 100 1.2', id); // +20
    await sleep(3100); // crash 3s cooldown
    await run('v crash 100 1.2', id); // +20
    Math.random = realRandom;
    const won = (db.ensureUser(id).total_won || 0) - w0;
    check('two consecutive wins -> total_won += exactly 40', won === 40, `wonDelta=${won}`);
  }

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
    process.exit(1);
  }
  console.log('ALL CRASH REGRESSION TESTS PASSED');
})();