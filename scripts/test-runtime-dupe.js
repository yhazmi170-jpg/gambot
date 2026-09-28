// test-runtime-dupe.js — regression for the 2026-09 duplicate-message + startup-DM audit:
//   1. same message id sequential  -> executes once, [DUPLICATE_DROP] logged
//   2. same message id concurrent  -> executes once
//   3. different ids, same content -> both execute
//   4. one command execution       -> exactly one outbound response
//   5. messageCreate registered exactly once in index.js (+ audit helper exists)
//   6. ready fires twice           -> startup DM sent once
//   7. resume/reconnect            -> NO startup DM (not a restart)
//   8. new boot                    -> startup DM sent once (fresh state)
//   9. startup DM send failure     -> retried once, bot alive, [STARTUP_DM_FAILED] logged
//  10. [DUPLICATE_DROP] carries the same message_id + same boot id
process.env.DB_PATH = '/tmp/dupe_test';
const fs = require('fs');
fs.rmSync('/tmp/dupe_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/dupe_test', { recursive: true });

const assert = require('assert');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + label + (extra ? '  — ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  — ' + extra : '')); }
};

// ---- stub discord.js (no live gateway) so commandHandler/chat paths load ----
const Module = require('module');
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
  get(_, prop) {
    if (prop === 'ButtonStyle') return { Primary: 1, Secondary: 2, Success: 3, Danger: 4 };
    if (prop === 'ChannelType') return { GuildText: 0, DM: 1 };
    if (prop === 'Collection') return class extends Map { map(fn) { return [...this.values()].map(fn); } };
    return function Stub() { return stubInstance(); };
  },
});
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') return discordStub;
  return origLoad.apply(this, arguments);
};

const db = require('../db');
const handler = require('../utils/commandHandler');
const runtime = require('../utils/runtime');
const notifier = require('../utils/startupNotifier');
const sendLog = require('../utils/sendLog');

function makeMessage(content, userId, opts = {}) {
  const sends = [];
  const channel = {
    id: 'chan_it', type: 0,
    send(payload) {
      sends.push(payload);
      return Promise.resolve({ id: 'm' + sends.length, delete: () => Promise.resolve(), edit: () => Promise.resolve(), createMessageComponentCollector: () => ({ on() {} }), awaitMessageComponent: () => new Promise(() => {}) });
    },
    createMessageComponentCollector: () => ({ on() {} }),
  };
  return {
    content, author: { id: userId, bot: false, username: 'DupTester' }, guild: opts.guild,
    channel, _sends: sends, id: opts.id !== undefined ? opts.id : 'm' + (++seq),
    createdAt: new Date(), createdTimestamp: Date.now(), cleanContent: content,
    mentions: { users: { first: () => null }, roles: { first: () => null }, channels: { first: () => null }, everyone: false },
    reply: channel.send.bind(channel), react: () => Promise.resolve(),
    guildId: opts.guild ? 'guild_it' : undefined, channelId: 'chan_it',
    client: { user: { id: 'b' }, guilds: { cache: new Map() }, users: { cache: new Map() }, channels: { cache: new Map() } },
  };
}
let seq = 0;

async function captureLog(fn) {
  const logs = [];
  const oLog = console.log, oErr = console.error;
  console.log = (...a) => { logs.push('L ' + a.join(' ')); };
  console.error = (...a) => { logs.push('E ' + a.join(' ')); };
  try { await fn(); } finally { console.log = oLog; console.error = oErr; }
  return logs;
}

// fake discord client for startupNotifier
function fakeClient(sendImpl) {
  let attempts = 0;
  const sends = [];
  const user = { id: 'owner', send: async (b) => { attempts++; sends.push(b); if (sendImpl) await sendImpl(sends.length); } };
  return {
    users: { fetch: async () => user },
    guilds: { cache: { size: 4 } },
    _attempts: () => attempts,
    _sends: sends,
  };
}

(async () => {
  await db.init();
  handler.loadCommands();
  db.exec(`INSERT OR REPLACE INTO server_access (guild_id, status, guild_name, first_seen_at, activated_at, activated_by)
           VALUES ('guild_it', 'active', 'Dup Guild', 0, 0, 'test')`);
  db.exec(`INSERT INTO users (user_id, balance, terms_accepted) VALUES ('dupuser', 5000, 1)`);

  // ---- 1/2/10: same message id (sequential + concurrent) executes once ------
  {
    const msg = makeMessage('v bal', 'dupuser', { guild: null, id: 'DD-1' });
    let logs = await captureLog(async () => { await handler.handleMessage(msg); });
    const firstSends = msg._sends.length;
    check('1. first execution replied', firstSends >= 1, 'sends=' + firstSends);
    logs = await captureLog(async () => { await handler.handleMessage(msg); });
    check('1. same message id sequential executes once', msg._sends.length === firstSends, 'sends=' + msg._sends.length);
    const drop = logs.find(l => l.startsWith('L [DUPLICATE_DROP]'));
    check('1. duplicate drop logged', !!drop, drop || 'no line');
    check('10. drop has same message_id', drop && drop.includes(`message_id=DD-1`), drop || '');
    check('10. drop has same boot id', drop && drop.includes(`boot=${runtime.shortId()}`), drop || '');
    check('10. drop has same pid', drop && drop.includes(`pid=${process.pid}`), drop || '');
    check('10. drop has age_ms', drop && /age_ms=\d+/.test(drop), drop || '');
  }
  {
    const msg = makeMessage('v bal', 'dupuser', { guild: null, id: 'DD-2' });
    const msgs = await captureLog(async () => { await Promise.all([handler.handleMessage(msg), handler.handleMessage(msg)]); });
    check('2. same message id concurrent executes once', msg._sends.length === 1, 'sends=' + msg._sends.length);
    check('2. concurrent duplicate logged once', msgs.filter(l => l.startsWith('L [DUPLICATE_DROP]')).length === 1, '');
  }

  // ---- 3/4: different ids -> both run; one command -> one response ----------
  {
    const m1 = makeMessage('v bal', 'dupuser', { guild: null });
    const m2 = makeMessage('v bal', 'dupuser', { guild: null });
    await captureLog(async () => { await handler.handleMessage(m1); await handler.handleMessage(m2); });
    check('3. different ids still execute', m1._sends.length === 1 && m2._sends.length === 1, `sends=${m1._sends.length}/${m2._sends.length}`);
  }
  {
    const m1 = makeMessage('v bal', 'dupuser', { guild: null });
    let cmdLines = 0;
    await captureLog(async () => { await handler.handleMessage(m1); });
    const all = await captureLog(async () => { await handler.handleMessage(m1); });
    check('4. one execution -> one response', m1._sends.length === 1, 'sends=' + m1._sends.length);
  }

  // ---- 5: messageCreate registered exactly once in production index.js ------
  {
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
    const onCount = (src.match(/client\.on\('messageCreate'/g) || []).length;
    const callCount = (src.match(/handleMessage\(message\)/g) || []).length;
    check('5. index.js registers messageCreate once', onCount === 1, 'on=' + onCount);
    check('5. index.js calls handleMessage once per event', callCount === 1, 'calls=' + callCount);
  }

  // ---- 6: ready fires twice -> startup DM once ------------------------------
  {
    notifier._resetForTests();
    const cl = fakeClient();
    const first = notifier.onGatewayReady(cl, 'owner', { retryDelayMs: 5 });
    await new Promise(r => setTimeout(r, 20));
    const second = notifier.onGatewayReady(cl, 'owner', { retryDelayMs: 5 });
    check('6. first ready dispatches DM', first === true);
    check('6. second ready skipped', second === false);
    check('6. DM sent exactly once', notifier.getDmCount() === 1, 'dmCount=' + notifier.getDmCount());
    check('6. DM is short + has boot id + no secrets', cl._sends[0] && cl._sends[0].includes('Boot ID: ' + runtime.shortId()) && cl._sends[0].includes('PID: ' + process.pid) && cl._sends[0].length < 1000, 'len=' + (cl._sends[0] || '').length);
  }

  // ---- 7: resume/reconnect -> NO startup DM -----------------------------------
  {
    notifier._resetForTests();
    const cl = fakeClient();
    notifier.gatewayResumed();
    notifier.gatewayReconnecting();
    await new Promise(r => setTimeout(r, 10));
    check('7. resume/reconnect never DMs', notifier.getDmCount() === 0 && cl._sends.length === 0);
  }

  // ---- 8: fresh boot -> startup DM once --------------------------------------
  {
    notifier._resetForTests();
    const cl = fakeClient();
    const ok = notifier.onGatewayReady(cl, 'owner', { retryDelayMs: 5 });
    await new Promise(r => setTimeout(r, 20));
    check('8. new boot dispatches one DM', ok === true && notifier.getDmCount() === 1);
  }

  // ---- 9: DM failure -> retried once, alive, failure logged -------------------
  {
    notifier._resetForTests();
    const failClient = fakeClient(() => { throw new Error('500 something went wrong'); });
    const logs = await captureLog(async () => {
      const r = await notifier.sendStartupDm(failClient, 'owner', 5);
      check('9. sendStartupDm fails softly (returns false, no throw)', r === false);
    });
    check('9. exactly 2 attempts', failClient._attempts() === 2, 'attempts=' + failClient._attempts());
    check('9. failure logged loudly', logs.some(l => l.startsWith('E [STARTUP_DM_FAILED]')), '');
    check('9. retry logged', logs.some(l => l.startsWith('E [STARTUP_DM_RETRY]')), '');
    check('9. notifier still usable, zero DMs counted', notifier.getDmCount() === 0);
  }

  // ---- bonus: sendLog outbound line shape --------------------------------------
  {
    const logs = await captureLog(async () => {
      sendLog.logSend('reply', { id: 'chan-x', reference: { messageId: 'src-9' } }, Promise.resolve({ id: 'out-7' }), 'src-9');
      await new Promise(r => setTimeout(r, 10));
    });
    const line = logs.find(l => l.startsWith('L [SEND]'));
    check('sendLog emits [SEND] with source+out msg ids', !!line && line.includes('source_msg=src-9') && line.includes('out_msg=out-7') && line.includes('boot=' + runtime.shortId()), line || '');
  }

  const extra = (fail === 0) ? '' : ` (${fail} FAILED)`;
  console.log(`\n${pass} passed, ${fail} failed${extra}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS CRASH:', e && e.stack); process.exit(1); });