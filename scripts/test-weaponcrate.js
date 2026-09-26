// v wc open [count|all] regression: quantity/all parsing, atomic open, one response.
process.env.DB_PATH = '/tmp/weaponcrate_test';
const fs = require('fs');
fs.rmSync('/tmp/weaponcrate_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/weaponcrate_test', { recursive: true });

let pass = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
}

const Module = require('module');
const origLoad = Module._load;
class StubEmbed {
  constructor() { this._title = ''; this._fields = []; }
  setColor(c) { this._color = c; return this; }
  setTitle(t) { this._title = t; return this; }
  setDescription(d) { this._description = d; return this; }
  addFields(...args) { for (const a of args) this._fields.push(a); return this; }
  toJSON() { return { title: this._title, fields: this._fields }; }
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

function makeMsg(userId, content) {
  const sent = [];
  return {
    id: 'm' + Math.random().toString(36).slice(2),
    author: { id: userId, bot: false, username: 'tester' },
    guild: { id: '111' },
    channel: { id: '222', type: 0, send: async (payload) => { sent.push(payload); return {}; } },
    mentions: { users: { first: () => null } },
    content,
    react: async () => {},
    _sent: sent,
  };
}

async function main() {
  await db.init();
  handler.loadCommands();
  const cmd = handler.getCommand('wc');
  check('wc alias resolves to weaponcrate', !!cmd && cmd.name === 'weaponcrate');

  const field = (payload, name) => {
    const e = payload.embeds && payload.embeds[0];
    if (!e || !e._fields) return '';
    const f = e._fields.find(x => x.name === name);
    return f ? String(f.value) : '';
  };
  const titleOf = (msg) => msg._sent[0].embeds[0]._title;

  // --- 4 crates + v wc open all ---
  {
    const u = 'wc_all_4';
    db.addWeaponCrate(u, 4);
    const m = makeMsg(u, 'v wc open all');
    await cmd.execute(m, ['open', 'all']);
    check('4 + all: exactly ONE response', m._sent.length === 1, m._sent.length);
    check('4 + all: 4 weapons created', db.getWeaponInv(u).length === 4, db.getWeaponInv(u).length);
    check('4 + all: 0 crates left', db.getWeaponCrates(u) === 0, db.getWeaponCrates(u));
    check('4 + all: only ids move (4 distinct new weapons)', new Set(db.getWeaponInv(u).map(w => w.id)).size === 4);
    check('4 + all: compact multi-open title', /Opened 4 Weapon Crates/.test(titleOf(m)), titleOf(m));
    const drops = field(m._sent[0], 'Drops');
    const lines = drops.split('\n').filter(Boolean);
    check('4 + all: 4 drop lines in one field', lines.length === 4, lines.length);
    check('4 + all: crates-left field says 0', /0/.test(field(m._sent[0], 'Crates left')), field(m._sent[0], 'Crates left'));
  }

  // --- 4 crates + v wc open 2 ---
  {
    const u = 'wc_open2';
    db.addWeaponCrate(u, 4);
    const m = makeMsg(u, 'v wc open 2');
    await cmd.execute(m, ['open', '2']);
    check('4 + open 2: exactly ONE response', m._sent.length === 1, m._sent.length);
    check('4 + open 2: 2 weapons created', db.getWeaponInv(u).length === 2, db.getWeaponInv(u).length);
    check('4 + open 2: 2 crates left', db.getWeaponCrates(u) === 2, db.getWeaponCrates(u));
    check('4 + open 2: compact multi-open title', /Opened 2 Weapon Crates/.test(titleOf(m)), titleOf(m));
  }

  // --- 4 crates + v wc open (single) ---
  {
    const u = 'wc_open1';
    db.addWeaponCrate(u, 4);
    const m = makeMsg(u, 'v wc open');
    await cmd.execute(m, ['open']);
    check('4 + open: exactly ONE response', m._sent.length === 1);
    check('4 + open: 1 weapon created', db.getWeaponInv(u).length === 1, db.getWeaponInv(u).length);
    check('4 + open: 3 crates left', db.getWeaponCrates(u) === 3, db.getWeaponCrates(u));
    check('4 + open: rich single-weapon embed kept', /WEAPON/.test(titleOf(m)), titleOf(m));
    const id = field(m._sent[0], 'You got').match(/#(\d+)/);
    check('4 + open: single embed shows its weapon id', !!id && db.getWeapon(+id[1]) && db.getWeapon(+id[1]).user_id === u);
  }

  // --- 1 crate ---
  {
    const u = 'wc_one';
    db.addWeaponCrate(u, 1);
    const m = makeMsg(u, 'v wc open all');
    await cmd.execute(m, ['open', 'all']);
    check('1 crate + all: ONE response, 1 weapon, 0 left', m._sent.length === 1 && db.getWeaponInv(u).length === 1 && db.getWeaponCrates(u) === 0);
  }

  // --- 0 crates: clean error ---
  {
    const u = 'wc_zero';
    const m = makeMsg(u, 'v wc open all');
    await cmd.execute(m, ['open', 'all']);
    check('0 crates + all: clean error embed (tells you have 0)', m._sent.length === 1 && /0\*\* weapon crates/.test(String(m._sent[0].embeds[0]._fields[0].value)), titleOf(m));
    check('0 crates + all: crates untouched (0, never negative)', db.getWeaponCrates(u) === 0, db.getWeaponCrates(u));
  }

  // --- quantity > owned: clean error, nothing consumed ---
  {
    const u = 'wc_overshoot';
    db.addWeaponCrate(u, 4);
    const m = makeMsg(u, 'v wc open 7');
    await cmd.execute(m, ['open', '7']);
    check('4 + open 7: clean error mentioning only 4', titleOf(m) === 'Error' && /only have \*\*4\*\*/.test(field(m._sent[0], 'message')), field(m._sent[0], 'message'));
    check('4 + open 7: nothing consumed', db.getWeaponCrates(u) === 4 && db.getWeaponInv(u).length === 0);
  }

  // --- invalid quantities ---
  for (const bad of ['abc', '-2', '0']) {
    const u = 'wc_bad_' + bad.replace('-', 'n').replace('.', 'p');
    db.addWeaponCrate(u, 3);
    const m = makeMsg(u, `v wc open ${bad}`);
    await cmd.execute(m, ['open', bad]);
    check(`3 + open ${bad}: clean invalid error`, m._sent.length === 1 && titleOf(m) === 'Error' && /invalid crate count/.test(field(m._sent[0], 'message')), field(m._sent[0], 'message'));
    check(`3 + open ${bad}: nothing consumed`, db.getWeaponCrates(u) === 3 && db.getWeaponInv(u).length === 0);
  }

  // --- case-insensitive ALL ---
  {
    const u = 'wc_upper';
    db.addWeaponCrate(u, 2);
    const m = makeMsg(u, 'v wc open ALL');
    await cmd.execute(m, ['open', 'ALL']);
    check('2 + ALL (uppercase): all consumed, 2 weapons, 0 left', m._sent.length === 1 && db.getWeaponInv(u).length === 2 && db.getWeaponCrates(u) === 0);
  }

  // --- repeated execution can never go negative or double-reward ---
  {
    const u = 'wc_repeat';
    db.addWeaponCrate(u, 2);
    const a = makeMsg(u, 'v wc open all'); await cmd.execute(a, ['open', 'all']);
    const before = db.getWeaponInv(u).length;
    const b = makeMsg(u, 'v wc open all'); await cmd.execute(b, ['open', 'all']);
    const c = makeMsg(u, 'v wc open all'); await cmd.execute(c, ['open', 'all']);
    check('repeat: 2nd+ opens are clean 0-crate messages', b._sent.length === 1 && /0\*\* weapon crates/.test(String(b._sent[0].embeds[0]._fields[0].value)) && c._sent.length === 1 && /0\*\* weapon crates/.test(String(c._sent[0].embeds[0]._fields[0].value)));
    check('repeat: no negative crate count', db.getWeaponCrates(u) === 0, db.getWeaponCrates(u));
    check('repeat: no duplicate weapons after reruns', db.getWeaponInv(u).length === before, `${db.getWeaponInv(u).length} != ${before}`);
    check('repeat: no duplicate ids', new Set(db.getWeaponInv(u).map(w => w.id)).size === db.getWeaponInv(u).length);
  }

  // --- buy + aliases preserved ---
  {
    const u = 'wc_buy';
    db.addBalance(u, 1000000);
    const m = makeMsg(u, 'v wc buy');
    await cmd.execute(m, ['buy']);
    check('buy still works (1 crate)', db.getWeaponCrates(u) === 1, db.getWeaponCrates(u));
    check('wcrate alias resolves', handler.getCommand('wcrate') && handler.getCommand('wcrate').name === 'weaponcrate');
    check('wepcrate alias resolves', handler.getCommand('wepcrate') && handler.getCommand('wepcrate').name === 'weaponcrate');
    check('has help metadata', !!cmd.helpCategory && !!cmd.description);
  }

  // --- independent RNG per crate ---
  {
    const u = 'wc_rng';
    const realRandom = Math.random;
    const calls = [];
    Math.random = () => { calls.push(calls.length); return realRandom(); };
    db.addWeaponCrate(u, 3);
    await cmd.execute(makeMsg(u, 'v wc open all'), ['open', 'all']);
    Math.random = realRandom;
    check('3 + all: multiple independent RNG rolls per crate (>= 6: rarity+type each)', calls.length >= 6, calls.length);
  }

  // --- direct db.openWeaponCrate still returns single shape ---
  {
    const u = 'wc_db_single';
    db.addWeaponCrate(u, 2);
    const r = db.openWeaponCrate(u);
    check('db.openWeaponCrate: ok + has id/name/rarity', r.ok === true && !!r.id && !!r.name && !!r.rarity, JSON.stringify(r).slice(0, 80));
    check('db.openWeaponCrate: consumed exactly 1', db.getWeaponCrates(u) === 1, db.getWeaponCrates(u));
    const r2 = db.openWeaponCrates(u, 5);
    check('openWeaponCrates caps at owned (1 left -> 1 opened)', r2.ok && r2.opened.length === 1 && r2.cratesLeft === 0 && db.getWeaponCrates(u) === 0, JSON.stringify(r2).slice(0, 80));
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('TEST CRASH', e); process.exit(1); });