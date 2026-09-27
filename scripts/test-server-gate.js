// test-server-gate.js — regression for the server gate ("v psu").
// Gambot can be IN a server without being allowed to be USED there: every guild it
// joins starts locked, so members get a "run v psu" notice instead of commands,
// until the owner runs `v psu` in that server. The 4 pre-existing servers are
// seeded active so this can never lock a live server.
process.env.DB_PATH = '/tmp/gate_test';
const fs = require('fs');
fs.rmSync('/tmp/gate_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/gate_test', { recursive: true });

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + label + (extra ? '  — ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  — ' + extra : '')); }
};

// ---- load the REAL discord.js embed path BEFORE the stub patch ---------------
// utils/embed must be cached with the real EmbedBuilder so embed text is readable
// in the assertions below (same trick as test-audit-fixes.js).
require('discord.js');
require('../utils/embed');

// ---- stub discord.js for everything else (no live gateway) -------------------
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
const OWNER = config.ownerId;
const NEW_GUILD = 'g_newserver';
let seq = 0;

function makeMessage(content, userId, guild) {
  const sends = [];
  const channel = {
    id: 'chan_gate', type: 0,
    send(payload) {
      sends.push(payload);
      return Promise.resolve({ delete: () => Promise.resolve(), id: 'm', edit: () => Promise.resolve(), createMessageComponentCollector: () => ({ on() {} }), awaitMessageComponent: () => new Promise(() => {}) });
    },
    createMessageComponentCollector: () => ({ on() {} }),
  };
  return {
    content, author: { id: userId, bot: false, username: 'GateTester' }, guild: guild || null,
    channel, _sends: sends, id: 'm' + (seq++),
    createdAt: new Date(), createdTimestamp: Date.now(), cleanContent: content,
    mentions: { users: { first: () => ({ id: 'other', bot: false, username: 'Other', send: () => Promise.resolve() }) }, roles: { first: () => null }, channels: { first: () => null }, everyone: false },
    reply: channel.send.bind(channel), react: () => Promise.resolve(),
    guildId: guild ? guild.id : undefined, channelId: 'chan_gate',
    client: { user: { id: 'bot' }, guilds: { cache: new Map() }, users: { cache: new Map() }, channels: { cache: new Map() } },
  };
}
const txt = (msg) => msg._sends.map((s) => {
  if (s.content) return String(s.content);
  return (s.embeds || []).map((e) => {
    const d = e.data || e;
    const parts = [d.title, d.description].filter(Boolean);
    for (const f of d.fields || []) { parts.push(f.name, f.value); }
    return parts.join(' ');
  }).join(' ');
}).join(' | ');
const bal = (u) => { const r = db.exec(`SELECT balance FROM users WHERE user_id = '${u}'`); return (r.length && r[0].values.length) ? r[0].values[0][0] : null; };
// commands share a 2s per-user cooldown in utils/cooldowns.js — sleep past it so
// consecutive psu calls actually execute instead of being rate-limited
const nap = () => new Promise((r) => setTimeout(r, 2200));

(async () => {
  await db.init();
  handler.loadCommands();
  // registered users (TOS accepted) so the TOS prompt doesn't intercept assertions
  db.exec(`INSERT OR IGNORE INTO users (user_id, balance, terms_accepted) VALUES ('${OWNER}', 1000, 1)`);
  db.exec(`INSERT OR IGNORE INTO users (user_id, balance, terms_accepted) VALUES ('member', 5000, 1)`);

  // 1. the 4 live servers are seeded active (the gate can never lock them)
  check('seeds all 4 current servers as active', db.SEED_ACTIVE_GUILDS.length === 4 && db.SEED_ACTIVE_GUILDS.every((g) => db.isServerActive(g)), db.SEED_ACTIVE_GUILDS.join(','));
  check('idempotent across re-init', (() => { db.noteServerPending(db.SEED_ACTIVE_GUILDS[0], 'x'); return db.getServerAccess(db.SEED_ACTIVE_GUILDS[0]).status === 'active'; })());

  // 2. unknown server = locked, recorded once (one owner DM per server)
  check('unknown server is locked', db.isServerActive(NEW_GUILD) === false);
  const first = db.noteServerPending(NEW_GUILD, 'New Server');
  check('first sighting is "new" (owner gets one DM)', first.isNew === true);
  const second = db.noteServerPending(NEW_GUILD, 'New Server');
  check('repeat sighting is not new (no repeat DM)', second.isNew === false);
  check('name captured + still pending', db.getServerAccess(NEW_GUILD).guildName === 'New Server' && db.isServerActive(NEW_GUILD) === false);
  check('DMs are never gated', db.isServerActive(null) === true);

  // 3. a member command in a locked server is blocked, with the unlock hint
  {
    db.exec(`INSERT OR IGNORE INTO users (user_id, balance, terms_accepted) VALUES ('member', 5000, 1)`);
    const before = bal('member');
    const msg = makeMessage('v work', 'member', { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(msg);
    const sent = txt(msg);
    check('locked server: member gets the v psu notice', /v psu/.test(sent), sent.slice(0, 90));
    check('locked server: command had no effect', bal('member') === before, `balance=${bal('member')}`);
  }

  // 4. the notice is rate-limited (30 min) so a locked server can't be flooded
  {
    const msg = makeMessage('v work', 'member', { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(msg);
    check('second command in the same window is silent', msg._sends.length === 0);
  }

  // 5. the owner is never gated
  {
    const msg = makeMessage('v bal', OWNER, { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(msg);
    check('owner works in a locked server', msg._sends.length > 0 && !/v psu/.test(txt(msg)));
  }

  // 6. v psu unlocks it, then members are through
  {
    const msg = makeMessage('v psu', OWNER, { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(msg);
    check('v psu unlocks the server', db.isServerActive(NEW_GUILD) === true && /Unlocked/.test(txt(msg)), txt(msg).slice(0, 90));
    const rec = db.getServerAccess(NEW_GUILD);
    check('activation is recorded with the owner', rec.activatedBy === OWNER && rec.activatedAt > 0);
    const before = bal('member');
    const after = makeMessage('v work', 'member', { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(after);
    check('members can use the bot after psu', !/v psu/.test(txt(after)) && bal('member') !== before, `balance ${before} -> ${bal('member')}`);
  }

  // 7. re-running it is a friendly no-op
  {
    await nap();
    const msg = makeMessage('v psu', OWNER, { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(msg);
    check('re-running psu says already unlocked', /already unlocked/.test(txt(msg)) && db.isServerActive(NEW_GUILD) === true);
  }

  // 8. psu in DMs can't unlock, and a non-owner can never unlock
  {
    await nap();
    const dm = makeMessage('v psu', OWNER, null);
    await handler.handleMessage(dm);
    check('psu in DMs refuses', /inside a server/i.test(txt(dm)));
    // non-owner in a LOCKED server: hits the lock, never the command
    await nap();
    const locked = makeMessage('v psu', 'member', { id: 'g_other', name: 'Other' });
    await handler.handleMessage(locked);
    check('non-owner in a locked server gets the lock notice', /not unlocked/.test(txt(locked)));
    check('and the server stays locked', db.isServerActive('g_other') === false && db.getServerAccess('g_other').status === 'pending');
    // non-owner in an UNLOCKED server: reaches the command, which refuses
    await nap();
    const unlocked = makeMessage('v psu', 'member', { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(unlocked);
    check('non-owner psu is denied', /owner only/i.test(txt(unlocked)));
    check('denied psu did not change the owner of the row', db.getServerAccess(NEW_GUILD).activatedBy === OWNER);
  }

  // 9. DM commands are never blocked
  {
    const msg = makeMessage('v bal', 'member', null);
    await handler.handleMessage(msg);
    check('commands in DMs are not gated', msg._sends.length > 0 && !/v psu/.test(txt(msg)));
  }

  // 10. list view + injection-safe ids
  {
    await nap();
    const msg = makeMessage('v psu list', OWNER, null);
    await handler.handleMessage(msg);
    const out = txt(msg);
    check('psu list renders all three sections', /unlocked \(\d+\)/.test(out) && /locked \(\d+\)/.test(out) && /waiting \(\d+\)/.test(out), out.slice(0, 100));
    const { active, pending } = db.listServerAccess();
    check('list buckets the 4 seeds + the activated server as unlocked',
      active.length === 5 && db.SEED_ACTIVE_GUILDS.every((g) => active.some((a) => a.guildId === g)), `active=${active.length}`);
    check('list buckets the locked server as waiting', pending.length === 1 && pending[0].guildId === 'g_other', `pending=${pending.length}`);

    const evil = `g_'; DROP TABLE server_access; --`;
    let threw = false;
    try { db.noteServerPending(evil, "o'brien"); } catch (e) { threw = true; }
    check('quote-y guild id cannot break the table', !threw && db.getServerAccess(evil) !== null && db.listServerAccess().pending.length === 2);
  }

  // 11. v usp locks a server, and works by id from ANY server
  {
    await nap();
    const msg = makeMessage('v usp', OWNER, { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(msg);
    check('usp locks the current server', db.getServerAccess(NEW_GUILD).status === 'locked' && /Locked/.test(txt(msg)), txt(msg).slice(0, 80));
    const before = bal('member');
    const member = makeMessage('v work', 'member', { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(member);
    check('a member who was already told stays quiet (30 min rate limit)', member._sends.length === 0);
    db.exec(`INSERT OR IGNORE INTO users (user_id, balance, terms_accepted) VALUES ('member2', 5000, 1)`);
    const fresh = makeMessage('v work', 'member2', { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(fresh);
    // the 30-min quiet window is per SERVER, not per user: a second member is quiet too
    check('a second member in the same window is quiet as well', fresh._sends.length === 0);
    check('locking changes no economy data', bal('member') === before && before > 0);
    // a DIFFERENT server, by pasted id — the whole point of the command
    await nap();
    const remote = '1539999999999999999';
    const fromElsewhere = makeMessage(`v usp ${remote}`, OWNER, { id: 'g_hub', name: 'Hub' });
    await handler.handleMessage(fromElsewhere);
    check('usp <id> locks a remote server from another server', db.getServerAccess(remote).status === 'locked' && db.isServerActive(remote) === false);
    check('the server you ran it in is untouched', db.getServerAccess('g_hub') === null && /Locked/.test(txt(fromElsewhere)));
    // re-lock is a no-op
    await nap();
    const again = makeMessage(`v usp ${remote}`, OWNER, { id: 'g_hub', name: 'Hub' });
    await handler.handleMessage(again);
    check('re-locking says already locked', /already locked/.test(txt(again)));
  }

  // 12. v psu <id> unlocks it again from anywhere
  {
    await nap();
    const remote = '1539999999999999999';
    const msg = makeMessage(`v psu ${remote}`, OWNER, { id: 'g_hub', name: 'Hub' });
    await handler.handleMessage(msg);
    check('psu <id> unlocks a remote server', db.getServerAccess(remote).status === 'active' && /Unlocked/.test(txt(msg)), txt(msg).slice(0, 80));
    // backticked id, straight out of the list
    await nap();
    const msg2 = makeMessage('v psu `1540000000000000001`', OWNER, { id: 'g_hub', name: 'Hub' });
    await handler.handleMessage(msg2);
    check('a pasted `id` from the list works', db.getServerAccess('1540000000000000001').status === 'active', txt(msg2).slice(0, 70));
    // a typo'd id is a clean error, not a silent no-op
    await nap();
    const bad = makeMessage('v psu 123', OWNER, { id: 'g_hub', name: 'Hub' });
    await handler.handleMessage(bad);
    check('a malformed id is refused clearly', /not a server id/i.test(txt(bad)));
  }

  // 13. psu/usp guard rails: owner only, DMs, no-arg behaviour
  {
    // NEW_GUILD is locked right now — unlock it first so the non-owner test
    // actually reaches the command instead of stopping at the gate
    await nap();
    const reopen = makeMessage('v psu', OWNER, { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(reopen);
    check('psu re-unlocks a locked server', db.getServerAccess(NEW_GUILD).status === 'active');
    await nap();
    const nonOwner = makeMessage('v usp', 'member', { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(nonOwner);
    check('non-owner usp is denied', /owner only/i.test(txt(nonOwner)) && db.getServerAccess(NEW_GUILD).status === 'active');
    const dm = makeMessage('v usp', OWNER, null);
    await handler.handleMessage(dm);
    check('usp in DMs refuses', /inside a server/i.test(txt(dm)));
    const dmPsu = makeMessage('v psu', OWNER, null);
    await handler.handleMessage(dmPsu);
    check('psu in DMs points at the list', /psu list|inside a server/i.test(txt(dmPsu)));
    await nap();
    const uspNoop = makeMessage('v usp', OWNER, { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(uspNoop);
    await nap();
    const uspNoop2 = makeMessage('v usp', OWNER, { id: NEW_GUILD, name: 'New Server' });
    await handler.handleMessage(uspNoop2);
    check('usp twice in a row is a clean no-op', /already locked/.test(txt(uspNoop2)));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
