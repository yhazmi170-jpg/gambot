// Regression for the "JayJay made this" credit (utils/credit.js):
//   1. gate is OFF on every /tmp test DB (so no existing test can ever see an
//      extra reply), OFF when GAMBOT_CREDIT=off, ON when on/force
//   2. command path: no credit by default, credit + 😭 reaction when forced
//   3. passive path: drops the line + 😭 in an ACTIVE server only, then keeps
//      rescheduling forever; the delay window is 60-180 min
process.env.DB_PATH = '/tmp/credit_test';
const fs = require('fs');
fs.rmSync('/tmp/credit_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/credit_test', { recursive: true });

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + label + (extra ? '  — ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  FAIL ' + extra : '')); }
};

// ---- load the REAL discord.js path first (same trick as test-server-gate.js) --
require('discord.js');
require('../utils/embed');

// ---- stub discord.js so nothing opens a gateway -------------------------------
const Module = require('module');
const origLoad = Module._load;
function stubInstance() {
  const target = {};
  const handler = {
    get(t, p) { if (p === 'then') return undefined; if (!(p in t)) t[p] = () => proxy; return t[p]; },
    set(t, p, v) { t[p] = v; return true; },
  };
  const proxy = new Proxy(target, handler);
  return proxy;
}
const discordStub = new Proxy({}, {
  get(_, prop) {
    if (prop === 'ButtonStyle') return { Primary: 1, Secondary: 2, Success: 3, Danger: 4 };
    if (prop === 'ChannelType') return { GuildText: 0, DM: 1 };
    if (prop === 'Collection') return class extends Map { map(fn) { return [...this.values()].map(fn); } };
    return function Stub() { return stubInstance(); };
  },
});
Module._load = function (request) {
  if (request === 'discord.js') return discordStub;
  return origLoad.apply(this, arguments);
};

const db = require('../db');
const handler = require('../utils/commandHandler');
const config = require('../config');
const credit = require('../utils/credit');

let seq = 0;
const uid = () => 'cr_it_' + (++seq);

function makeMessage(content, userId) {
  const replies = [];
  const sends = [];
  return {
    id: 'msg_cr_' + (++seq),
    content,
    author: { id: userId, bot: false },
    guild: null,
    channel: {
      id: 'chan_cr',
      send(p) { sends.push(p); return Promise.resolve({ id: 'sent_cr_' + sends.length, react: () => Promise.resolve() }); },
    },
    _replies: replies,
    _sends: sends,
    reply(payload) {
      const sent = { id: 'reply_cr_' + replies.length, reactions: [], react(e) { sent.reactions.push(e); return Promise.resolve(sent); } };
      replies.push({ payload, sent });
      return Promise.resolve(sent);
    },
  };
}

async function run(content) {
  const id = uid();
  db.acceptTerms(id);
  const msg = makeMessage(content, id);
  await handler.handleMessage(msg);
  return { msg, replies: msg._replies, sends: msg._sends };
}

function makeGuildStub(id, active) {
  const sent = [];
  const channel = {
    id: 'chan_' + id,
    type: 0,
    permissionsFor: () => ({ has: () => true }),
    send(p) { sent.push(p); return Promise.resolve({ id: 'p_' + sent.length, react: () => Promise.resolve() }); },
  };
  return {
    sent,
    guild: {
      id,
      channels: { cache: new Map([[channel.id, channel]]) },
      members: { me: {} },
    },
  };
}

(async () => {
  await db.init();
  handler.loadCommands();

  console.log('== GATE ==');
  check('off on a /tmp test DB (default env)', credit.isEnabled() === false, `DB_PATH=${process.env.DB_PATH}`);
  process.env.GAMBOT_CREDIT = 'off';
  check('off when GAMBOT_CREDIT=off (even on a prod path)', credit.isEnabled() === false);
  process.env.GAMBOT_CREDIT = 'on';
  check('on when GAMBOT_CREDIT=on', credit.isEnabled() === true);
  process.env.GAMBOT_CREDIT = 'force';
  check('on when GAMBOT_CREDIT=force', credit.isEnabled() === true);
  delete process.env.GAMBOT_CREDIT;
  check('roll() is a strict 1-in-50', credit.COMMAND_CHANCE === 50, String(credit.COMMAND_CHANCE));
  const d = credit.pickDelay();
  check('passive delay inside 60-180 min', d >= 60 * 60 * 1000 && d <= 180 * 60 * 1000, `${d}ms`);

  console.log('== COMMAND PATH ==');
  let r = await run('v 8b hi');
  check('no credit on a test DB (single reply only)', r.replies.length === 1 && r.sends.length === 0, `replies=${r.replies.length} sends=${r.sends.length}`);
  process.env.GAMBOT_CREDIT = 'force';
  r = await run('v 8b hi');
  check('forced: second message is the credit', r.replies.length === 2 && r.replies[1].payload.content === credit.CREDIT_TEXT, JSON.stringify(r.replies.map(x => x.payload.content)));
  check('  credit reacts with 😭 (sob)', r.replies.length === 2 && r.replies[1].sent.reactions.includes(credit.SOB), JSON.stringify(r.replies[1] && r.replies[1].sent.reactions));
  check('  credit does not ping the asker', r.replies[1].payload.allowedMentions && r.replies[1].payload.allowedMentions.repliedUser === false, JSON.stringify(r.replies[1].payload.allowedMentions));
  check('  the command reply itself is untouched', r.replies[0].payload.content !== credit.CREDIT_TEXT, r.replies[0].payload.content);
  delete process.env.GAMBOT_CREDIT;

  console.log('== PASSIVE CHAT ==');
  // a locked (inactive) server must never be chosen
  const locked = makeGuildStub('g_locked_cr', false);
  const clientLocked = { guilds: { cache: new Map([[locked.guild.id, locked.guild]]) } };
  credit._reset();
  const h1 = credit.startPassive(clientLocked, { delayMs: 15, force: true, fresh: true });
  await new Promise(res => setTimeout(res, 80));
  check('locked/inactive server is skipped', locked.sent.length === 0, JSON.stringify(locked.sent));
  h1 && h1.stop();

  // an active server gets the line + the reaction
  db.activateServer('g_active_cr', config.ownerId, 'Active Test Guild', 'active');
  const active = makeGuildStub('g_active_cr', true);
  const clientActive = { guilds: { cache: new Map([[active.guild.id, active.guild]]) } };
  credit._reset();
  const h2 = credit.startPassive(clientActive, { delayMs: 15, force: true, fresh: true });
  await new Promise(res => setTimeout(res, 80));
  check('active server gets "JayJay made this"', active.sent.includes(credit.CREDIT_TEXT), JSON.stringify(active.sent));
  h2 && h2.stop();
  credit._reset();

  // and it keeps re-arming itself (free-running forever)
  const loop = makeGuildStub('g_active_cr', true);
  const clientLoop = { guilds: { cache: new Map([[loop.guild.id, loop.guild]]) } };
  const h3 = credit.startPassive(clientLoop, { delayMs: 15, force: true, fresh: true });
  await new Promise(res => setTimeout(res, 120));
  check('passive keeps firing on its own (>=2 drops)', loop.sent.filter(x => x === credit.CREDIT_TEXT).length >= 2, `drops=${loop.sent.length}`);
  h3 && h3.stop();
  credit._reset();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
