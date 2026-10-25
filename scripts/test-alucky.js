// Alucky (luckylist) regression: owner-only grant/remove godlike luck + list, 5x payWin.
process.env.DB_PATH = '/tmp/alucky_test';
const fs = require('fs');
fs.rmSync('/tmp/alucky_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/alucky_test', { recursive: true });

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
const OWNER = '536278876247162882';

function makeMsg(userId, content, mentionId) {
  const sent = [];
  return {
    id: 'm' + Math.random().toString(36).slice(2),
    author: { id: userId, bot: false, username: 'tester' },
    guild: { id: '111' },
    channel: { id: '222', type: 0, send: async (payload) => { sent.push(payload); return {}; } },
    mentions: { users: { first: () => (mentionId ? { id: mentionId, bot: false } : null) } },
    content,
    react: async () => {},
    _sent: sent,
  };
}

async function main() {
  await db.init();
  handler.loadCommands();
  const cmd = handler.getCommand('lucky');
  check('luckylist command registered', !!cmd && cmd.name === 'luckylist');
  check('alias lucky routes to it', handler.getCommand('lucky') === cmd);
  check('alias alucky routes to it', handler.getCommand('alucky') === cmd);
  check('has help metadata', cmd && !!cmd.helpCategory && !!cmd.description);

  const field = (msg, name) => {
    const e = msg._sent[0] && msg._sent[0].embeds[0];
    if (!e || !e._fields) return '';
    const f = e._fields.find(x => x.name === name);
    return f ? String(f.value) : '';
  };

  const target = 'gl_target_1';

  // non-owner blocked (list + toggle)
  {
    const m = makeMsg('somebody_else', 'Alucky @' + target, target);
    await cmd.execute(m, ['@' + target]);
    check('non-owner @mention: blocked', m._sent.length === 1 && /reserved for the bot owner/.test(field(m, 'message')), field(m, 'message'));
    const ml = makeMsg('somebody_else', 'Alucky');
    await cmd.execute(ml, []);
    check('non-owner list: blocked', ml._sent.length === 1 && /reserved for the bot owner/.test(field(ml, 'message')));
  }

  // owner: empty list
  {
    const m = makeMsg(OWNER, 'Alucky');
    await cmd.execute(m, []);
    check('owner empty list: says nobody', m._sent.length === 1 && /nobody/.test(field(m, 'Lucky')), field(m, 'Lucky'));
    check('owner empty list: not-lucky count = all users', /everyone else/.test(field(m, 'Not lucky')), field(m, 'Not lucky'));
  }

  // owner: grant
  {
    const m = makeMsg(OWNER, 'Alucky @' + target, target);
    await cmd.execute(m, ['@' + target]);
    check('grant golden', db.getGodLuck(target) === 1, db.getGodLuck(target));
    check('grant reply says godlike luck', m._sent.length === 1 && /godlike luck/.test(m._sent[0].embeds[0]._fields[0].value));
  }

  // list now shows the lucky user
  {
    const m = makeMsg(OWNER, 'Alucky list');
    await cmd.execute(m, ['list']);
    check('list shows the lucky user', m._sent.length === 1 && `<@${target}>` === field(m, 'Lucky').trim(), field(m, 'Lucky'));
  }

  // 5x win via payWin, no balance cut
  {
    db.addBalance(target, 3000000); // balance factor would be 0.4 for a normal user
    const before = db.getBalance(target);
    const paid = db.payWin(target, 10000, 0);
    check('god-luck win pays EXACTLY 5x (no cut): 50000', paid === 50000, paid);
    check('god-luck credit applied', db.getBalance(target) === before + 50000, `${db.getBalance(target)} != ${before + 50000}`);
  }

  // remove
  {
    const m = makeMsg(OWNER, 'Alucky @' + target, target);
    await cmd.execute(m, ['@' + target]);
    check('toggled off (god_luck=0)', db.getGodLuck(target) === 0);
    const before = db.getBalance(target);
    const paid = db.payWin(target, 10000, 0);
    check('normal win back to balance cut (0.94 at 3M -> 9400)', paid === 9400, paid);
    check('no extra credit beyond 9400', db.getBalance(target) === before + 9400);
  }

  // raw id arg (no mention object)
  {
    const m = makeMsg(OWNER, 'Alucky 111222333444555', null);
    await cmd.execute(m, ['111222333444555']);
    check('raw numeric id toggle works', db.getGodLuck('111222333444555') === 1, db.getGodLuck('111222333444555'));
    const m2 = makeMsg(OWNER, 'Alucky list');
    await cmd.execute(m2, ['list']);
    check('list includes raw-id target', m2._sent.length === 1 && /111222333444555/.test(field(m2, 'Lucky')));
    // cleanup
    await cmd.execute(makeMsg(OWNER, 'Alucky 111222333444555', null), ['111222333444555']);
  }

  // re-toggle off + list counts
  {
    await cmd.execute(makeMsg(OWNER, 'Alucky @' + target, target), ['@' + target]); // back ON for count check
    const m = makeMsg(OWNER, 'Alucky');
    await cmd.execute(m, []);
    const luckyCount = db.getLuckyUsers().length;
    check('list not-lucky count reflects lucky count', new RegExp(`everyone else \\(${(db.getAllUsers().length - luckyCount)} / ${db.getAllUsers().length} users\\)`).test(field(m, 'Not lucky')), field(m, 'Not lucky'));
  }

  // LUCKY_WIN_MULT exported
  check('LUCKY_WIN_MULT exported', db.LUCKY_WIN_MULT === 5, db.LUCKY_WIN_MULT);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('TEST CRASH', e); process.exit(1); });