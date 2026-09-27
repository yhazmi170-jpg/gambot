// test-audit-fixes.js — regression coverage for the 2026-09 reliability audit fixes:
//   1. rob.ts db.run -> db.exec crash (money used to move THEN crash = generic error)
//   2. embed() field ceiling 1024 (gamehelp/perkhelp used to always crash)
//   3. event.js unguarded cfg (unknown community-event key crashed)
//   4. handler DM null-guild guard (commands in DMs used to throw, no reply)
//   5. DB numeric guard (NaN/undefined/Infinity can never reach economy SQL)
process.env.DB_PATH = '/tmp/audit_test';
const fs = require('fs');
fs.rmSync('/tmp/audit_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/audit_test', { recursive: true });

const assert = require('assert');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + label + (extra ? '  — ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  — ' + extra : '')); }
};

// ---- load the REAL discord.js embed path BEFORE the stub patch ---------------
const { EmbedBuilder } = require('discord.js');
const embUtils = require('../utils/embed');

// 2. embed() must never exceed the 1024 field ceiling.
{
  const long = Array.from({ length: 40 }, (_, i) => `\`v gamehelp g${i + 1}\` — Game Number ${i + 1}`).join('\n');
  assert(long.length > 1024, 'fixture too short');
  const e = embUtils.embed('T', [['Games', long]]).data;
  check('embed() chunks a >1024 field', e.fields.every(f => f.value.length <= 1024), `fields=${e.fields.length}`);
  check('embed() renames continuations', e.fields[1].name.includes('(cont.)'));
}

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
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') return discordStub;
  return origLoad.apply(this, arguments);
};

const db = require('../db');
const handler = require('../utils/commandHandler');

function makeMessage(content, userId, opts = {}) {
  const sends = [];
  const channel = {
    id: 'chan_it', type: 0,
    send(payload) {
      sends.push(payload);
      return Promise.resolve({ delete: () => Promise.resolve(), id: 'm', edit: () => Promise.resolve(), createMessageComponentCollector: () => ({ on() {} }), awaitMessageComponent: () => new Promise(() => {}) });
    },
    createMessageComponentCollector: () => ({ on() {} }),
  };
  const victim = { id: 'victim', bot: false, username: 'Victim', send: () => Promise.resolve() };
  return {
    content, author: { id: userId, bot: false, username: 'RobTester' }, guild: opts.guild,
    channel, _sends: sends, id: 'm' + (pass + seq++),
    createdAt: new Date(), createdTimestamp: Date.now(), cleanContent: content,
    mentions: { users: { first: () => victim }, roles: { first: () => null }, channels: { first: () => null }, everyone: false },
    reply: channel.send.bind(channel), react: () => Promise.resolve(),
    guildId: channel.guildId ? 'guild_it' : undefined, channelId: 'chan_it',
    client: { user: { id: 'b' }, guilds: { cache: new Map() }, users: { cache: new Map() }, channels: { cache: new Map() } },
  };
}
let seq = 0;

(async () => {
  await db.init();
  handler.loadCommands();
  // the server gate locks unknown guilds; this suite's fixture guild is pre-approved
  db.exec(`INSERT OR REPLACE INTO server_access (guild_id, status, guild_name, first_seen_at, activated_at, activated_by)
           VALUES ('guild_it', 'active', 'Audit Guild', 0, 0, 'test')`);

  // 5. numeric guard
  {
    let threw = false;
    try { db.exec(`UPDATE users SET balance = balance - NaN WHERE user_id = 'x'`); } catch (e) { threw = /DB guard/.test(e.message); }
    check('db.exec rejects NaN writes', threw);
    threw = false;
    try { db.run(`UPDATE users SET balance = balance + undefined WHERE user_id = 'x'`); } catch (e) { threw = /DB guard/.test(e.message); }
    check('db.run rejects undefined writes', threw);
    check('safeNum exported + clamps', db.safeNum(undefined) === 0 && db.safeNum(Infinity) === 0 && db.safeNum(42) === 42);
  }

  // 1. rob full path: perk + wealth, must NOT throw and must conserve money.
  {
    db.exec(`INSERT INTO purchases (user_id, perk, expires_at) VALUES ('rober', 'rob', 0)`);
    db.exec(`INSERT INTO users (user_id, balance, bank, terms_accepted) VALUES ('rober', 20000000, 0, 1)`);
    db.exec(`INSERT INTO users (user_id, balance, bank, terms_accepted) VALUES ('victim', 20000000, 0, 1)`);
    const msg = makeMessage('v rob <@victim>', 'rober', { guild: { id: 'guild_it' } });
    let threw = null;
    try { await handler.handleMessage(msg); } catch (e) { threw = e; }
    check('rob did not throw (was db.run crash)', !threw, threw ? threw.message : '');
    check('rob replied', msg._sends.length >= 1, 'sends=' + msg._sends.length);
    const cd = Number(db.exec(`SELECT rob_cooldown FROM users WHERE user_id='rober'`)[0].values[0][0]);
    check('rob set rob_cooldown', cd > 0, 'cd=' + cd);
    // rob's own settlement conserves money (handler-level XP/level rewards are
    // separate and positive-only; measure rob itself on a fresh pair directly)
    db.exec(`INSERT INTO users (user_id, balance, bank, terms_accepted) VALUES ('rober2', 20000000, 0, 1)`);
    db.exec(`INSERT INTO users (user_id, balance, bank, terms_accepted) VALUES ('victim2', 20000000, 0, 1)`);
    const robCmd = require('../commands/rob');
    const msg2 = makeMessage('v rob <@victim2>', 'rober2', { guild: { id: 'guild_it' } });
    const bal = (id) => Number(db.exec(`SELECT balance FROM users WHERE user_id='${id}'`)[0].values[0][0]);
    try { await robCmd.execute(msg2, ['<@victim2>']); } catch (e) { threw = e; }
    check('rob.execute direct did not throw', !threw, threw ? threw.message : '');
    check('rob conserved total money', bal('rober2') + bal('victim2') === 40000000, `sum=${bal('rober2') + bal('victim2')}`);
  }

  // 3. event with an unknown/removed community-event key -> friendly reply, no crash
  {
    db.exec(`INSERT INTO community_events (key, ends_at) VALUES ('vanished_old_key', 9999999999)`);
    const msg = makeMessage('v event', 'roomba', { guild: { id: 'guild_it' } });
    let threw = null;
    try { await handler.handleMessage(msg); } catch (e) { threw = e; }
    check('v event unknown key did not throw', !threw, threw ? threw.message : '');
    check('v event unknown key replied', msg._sends.length >= 1);
    db.exec(`DELETE FROM community_events WHERE key='vanished_old_key'`);
  }

  // 4. DM (guild null) commands must reply, not throw
  {
    db.exec(`INSERT INTO users (user_id, balance, terms_accepted) VALUES ('dmuser', 5000, 1)`);
    const msg = makeMessage('v bal', 'dmuser', { guild: null });
    let threw = null;
    try { await handler.handleMessage(msg); } catch (e) { threw = e; }
    check('v bal in DM did not throw', !threw, threw ? threw.message : '');
    check('v bal in DM replied', msg._sends.length >= 1, 'sends=' + msg._sends.length);
  }

  // 2b. gamehelp / perkhelp integrate the chunker without crashing
  {
    const msg = makeMessage('v gamehelp', 'dmuser', { guild: { id: 'guild_it' } });
    const msg2 = makeMessage('v perkhelp', 'dmuser', { guild: { id: 'guild_it' } });
    let t1 = null, t2 = null;
    try { await handler.handleMessage(msg); } catch (e) { t1 = e; }
    try { await handler.handleMessage(msg2); } catch (e) { t2 = e; }
    check('v gamehelp did not throw', !t1, t1 ? t1.message : '');
    check('v perkhelp did not throw', !t2, t2 ? t2.message : '');
  }

  const extra = (fail === 0) ? '' : ` (${fail} FAILED)`;
  console.log(`\n${pass} passed, ${fail} failed${extra}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS CRASH:', e && e.stack); process.exit(1); });