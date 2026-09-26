// End-to-end: v activity command renders in all subcommand modes without throwing.
process.env.DB_PATH = '/tmp/activity_cmd_test';
const fs = require('fs');
fs.rmSync('/tmp/activity_cmd_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/activity_cmd_test', { recursive: true });

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
  toJSON() { return { title: this._title, fields: this._fields, description: this._description }; }
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

async function main() {
  await db.init();
  handler.loadCommands();
  const config = require('../config');
  const ownerId = config.ownerId;

  const cmd = handler.getCommand('activity');
  check('activity registered', !!cmd);
  check('activity has helpCategory', cmd && !!cmd.helpCategory);
  check('activity has description', cmd && !!cmd.description);
  check('aliases include usage', cmd && cmd.aliases && cmd.aliases.includes('usage'));

  // seed data
  const u1 = 'act_e2e_1', u2 = 'act_e2e_2';
  db.acceptTerms(u1); db.acceptTerms(u2);
  for (let i = 0; i < 3; i++) db.recordFeatureUse(u1, 'hunt');
  db.recordFeatureUse(u2, 'slots');
  db.addGambled(u1, 5000);
  db.addWon(u2, 10000);

  const fakeMessage = {
    id: 'm1',
    author: { id: u1, bot: false },
    guild: { id: '111' },
    channel: { id: '222', type: 0, send: async (payload) => { fakeMessage._sent = payload; return {}; } },
    mentions: { users: { first: () => null } },
    content: 'v activity',
    react: async () => {},
  };

  for (const line of ['v activity', 'v activity usage', 'v activity users', 'v activity gamble', 'v activity wins', 'v activity commands', 'v activity nonsense']) {
    fakeMessage._sent = null;
    fakeMessage.content = line;
    try {
      await Promise.resolve(handler.handleMessage(fakeMessage));
      check(`handled: ${line}`, !!fakeMessage._sent);
      const t = fakeMessage._sent && fakeMessage._sent.embeds && fakeMessage._sent.embeds[0] && fakeMessage._sent.embeds[0]._title;
      check(`rendered embed for: ${line}`, !!t, `title=${t}`);
    } catch (e) {
      check(`handled: ${line}`, false, e.stack || e.message);
    }
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('TEST CRASH', e); process.exit(1); });