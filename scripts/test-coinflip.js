// Integration/regression test for the LIVE coinflip command path.
// Drives the REAL command handler (prefix removal -> alias -> args -> parseBet
// -> side parsing -> RNG -> settlement -> response), with a fresh throwaway DB.
// NEVER touches production balances (DB_PATH is redirected to /tmp).
process.env.DB_PATH = '/tmp/coinflip_it';
const fs = require('fs');
fs.rmSync('/tmp/coinflip_it', { recursive: true, force: true });
fs.mkdirSync('/tmp/coinflip_it', { recursive: true });

// --- stub discord.js before anything requires it (no live gateway) ---
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

let seq = 0;
const uid = () => 'cf_it_' + (++seq);

function makeMessage(content, userId) {
  const sends = [];
  const channel = {
    id: 'chan_it',
    send(payload) {
      sends.push(payload);
      return Promise.resolve({
        delete: () => Promise.resolve(),
        edit: () => Promise.resolve(),
        createMessageComponentCollector: () => ({ on() {} }),
      });
    },
  };
  return { content, author: { id: userId, bot: false }, guild: { id: 'guild_it' }, channel, _sends: sends };
}

// Pull the coinflip reply (the message containing the 🪙 coin) out of all sends.
function coinReply(msg) {
  for (const s of msg._sends) if (typeof s === 'string' && s.includes('🪙')) return s;
  return null;
}
function errorReply(msg) {
  for (const s of msg._sends) {
    if (s && s.embeds && s.embeds[0]) {
      const e = s.embeds[0];
      const desc = (e.data && e.data.description) || e.description || '';
      if (desc) return desc;
    }
  }
  return null;
}

async function run(input) {
  const id = uid();
  db.acceptTerms(id);        // registered (skips TOS prompt) + START_BALANCE = 1000
  const msg = makeMessage(input, id);
  await handler.handleMessage(msg);
  return { id, msg, reply: coinReply(msg), err: errorReply(msg), bal: db.getBalance(id) };
}

(async () => {
  await db.init();
  handler.loadCommands();

  // capture the exact args array the live parser hands to the command
  const cf = handler.getCommand('coinflip');
  assert(cf, 'coinflip command did not load');
  let capturedArgs = null;
  const origExec = cf.execute;
  cf.execute = function (m, a) { capturedArgs = a ? a.slice() : a; return origExec.call(this, m, a); };

  const results = [];
  const check = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  // ---- 1. PARSER: argument order + aliases + casing ----
  console.log('\n== PARSER (through real handler) ==');
  let r = await run('v cf 100 heads');
  check('v cf 100 heads -> args [100,heads]', JSON.stringify(capturedArgs) === '["100","heads"]', JSON.stringify(capturedArgs));

  r = await run('v cf 100 tails');
  check('v cf 100 tails -> args [100,tails]', JSON.stringify(capturedArgs) === '["100","tails"]', JSON.stringify(capturedArgs));

  r = await run('v coin 100 h');
  check('alias coin + h -> args [100,h]', JSON.stringify(capturedArgs) === '["100","h"]', JSON.stringify(capturedArgs));

  r = await run('v flip 100 t');
  check('alias flip + t -> args [100,t]', JSON.stringify(capturedArgs) === '["100","t"]', JSON.stringify(capturedArgs));

  r = await run('v cf 100 HEADS');
  check('casing HEADS preserved in args [100,HEADS]', JSON.stringify(capturedArgs) === '["100","HEADS"]', JSON.stringify(capturedArgs));

  r = await run('v cf 100');
  check('v cf 100 (no side) -> args [100]', JSON.stringify(capturedArgs) === '["100"]', JSON.stringify(capturedArgs));

  r = await run('v cf heads 100');
  check('side-first "v cf heads 100" is rejected (no flip, balance unchanged)', r.reply === null && r.bal === 1000, `reply=${r.reply} bal=${r.bal}`);

  // ---- 2. FOUR FORCED-RNG CASES through the full command ----
  console.log('\n== FORCED RNG: all four logical cases ==');
  const realRandom = Math.random;

  async function forced(input, rand) {
    Math.random = () => rand;
    try { return await run(input); } finally { Math.random = realRandom; }
  }

  // heads + land heads = WIN
  r = await forced('v cf 100 heads', 0.10);
  check('heads + lands heads -> WIN, bal 1100', r.bal === 1100, `bal=${r.bal} reply="${r.reply}"`);
  check('  reply names landed side "heads" and a win', r.reply && /heads/i.test(r.reply) && /won/i.test(r.reply), r.reply);

  // heads + land tails = LOSS
  r = await forced('v cf 100 heads', 0.90);
  check('heads + lands tails -> LOSS, bal 900', r.bal === 900, `bal=${r.bal} reply="${r.reply}"`);
  check('  reply names landed side "tails" and a loss', r.reply && /tails/i.test(r.reply) && /lost/i.test(r.reply), r.reply);

  // tails + land tails = WIN
  r = await forced('v cf 100 tails', 0.10);
  check('tails + lands tails -> WIN, bal 1100', r.bal === 1100, `bal=${r.bal} reply="${r.reply}"`);

  // tails + land heads = LOSS
  r = await forced('v cf 100 tails', 0.90);
  check('tails + lands heads -> LOSS, bal 900', r.bal === 900, `bal=${r.bal} reply="${r.reply}"`);

  // ---- 3. LUCKY MODE: must respect the PLAYER'S side ----
  console.log('\n== LUCKY MODE (90% favour the selected side, 3x payout) ==');
  {
    const id = uid();
    db.acceptTerms(id); db.toggleLucky(id); // lucky ON
    Math.random = () => 0.10; // < 0.9 -> should WIN on whatever side was picked
    const msg = makeMessage('v cf 100 tails', id);
    await handler.handleMessage(msg);
    Math.random = realRandom;
    const rep = coinReply(msg);
    check('lucky + tails + roll 0.10 -> WIN on tails, bal 1300 (3x)', db.getBalance(id) === 1300, `bal=${db.getBalance(id)} reply="${rep}"`);
    check('  lucky win RESOLVES to the picked side (tails), not heads', rep && /tails/i.test(rep) && !/heads/i.test(rep), rep);
  }
  {
    const id = uid();
    db.acceptTerms(id); db.toggleLucky(id);
    Math.random = () => 0.95; // >= 0.9 -> the 10% unlucky loss, must land the OPPOSITE of pick
    const msg = makeMessage('v cf 100 tails', id);
    await handler.handleMessage(msg);
    Math.random = realRandom;
    const rep = coinReply(msg);
    check('lucky + tails + roll 0.95 -> loss, bal 900', db.getBalance(id) === 900, `bal=${db.getBalance(id)} reply="${rep}"`);
  }
  {
    const id = uid();
    db.acceptTerms(id); db.toggleLucky(id);
    Math.random = () => 0.10;
    const msg = makeMessage('v cf 100 heads', id);
    await handler.handleMessage(msg);
    Math.random = realRandom;
    check('lucky + heads + roll 0.10 -> WIN on heads, bal 1300', db.getBalance(id) === 1300, `bal=${db.getBalance(id)}`);
  }

  // ---- 4. DISPLAY vs SETTLEMENT consistency ----
  console.log('\n== DISPLAY / SETTLEMENT CONSISTENCY ==');
  r = await forced('v cf 100 heads', 0.10);
  {
    // reply must state both what the player picked and what landed, and the won
    // amount must equal the real balance delta (100), not the double-counted 200.
    const pickedShown = r.reply && /picked[^*]*\*\*heads\*\*/i.test(r.reply);
    check('win reply shows the PICKED side explicitly', pickedShown, r.reply);
    const m = r.reply && r.reply.match(/won \*\*(\d+)\*\*/i);
    const shownWon = m ? Number(m[1]) : null;
    check('win reply amount matches real settlement (+100)', shownWon === 100, `shown=${shownWon} balDelta=+100 reply="${r.reply}"`);
  }
  r = await forced('v cf 100 heads', 0.90);
  {
    const pickedShown = r.reply && /picked[^*]*\*\*heads\*\*/i.test(r.reply);
    check('loss reply shows the PICKED side explicitly', pickedShown, r.reply);
  }

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
    process.exit(1);
  }
  console.log('ALL COINFLIP INTEGRATION TESTS PASSED');
})();
