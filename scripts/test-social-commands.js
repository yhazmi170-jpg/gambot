process.env.DB_PATH = '/tmp/ach_cmd';
const fs = require('fs');
fs.rmSync('/tmp/ach_cmd', { recursive: true, force: true });
fs.mkdirSync('/tmp/ach_cmd', { recursive: true });

// --- stub discord.js before anything requires it ---
const Module = require('module');
const origLoad = Module._load;

class StubEmbed {
  constructor() { this._title = ''; this._fields = []; this._description = ''; this._color = 0; this._image = null; this._thumbnail = null; }
  setColor(c) { this._color = c; return this; }
  setTitle(t) { this._title = t; return this; }
  setDescription(d) { this._description = d; return this; }
  addFields(...args) { for (const a of args) this._fields.push(a); return this; }
  setImage(u) { this._image = u; return this; }
  setThumbnail(u) { this._thumbnail = u; return this; }
  setFooter(f) { this._footer = f; return this; }
  toJSON() { return { title: this._title, fields: this._fields, description: this._description, image: this._image, thumbnail: this._thumbnail }; }
}
function genericBuilder() {
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

const EXPECT = {
  hug:    { cat: 'hug',    react: '🤗' },
  kiss:   { cat: 'kiss',   react: '😘' },
  kill:   { cat: 'kill',   react: '💀' },
  slap:   { cat: 'slap',   react: '✋' },
  pat:    { cat: 'pat',    react: '🫳' },
  cuddle: { cat: 'cuddle', react: '🧸' },
  bite:   { cat: 'bite',   react: '😬' },
  punch:  { cat: 'punch',  react: '👊' },
  lick:   { cat: 'lick',   react: '👅' },
  bonk:   { cat: 'bonk',   react: '💨' },
  facepalm: { cat: 'facepalm', react: '🤦' },
  tease:  { cat: 'tease',  react: '🤣' },
  wave:   { cat: 'wave',   react: '👋' },
  poke:   { cat: 'poke',   react: '👀' },
  tickle: { cat: 'tickle', react: '🤣' },
  blush:  { cat: 'blush',  react: '😊' },
  cry:    { cat: 'cry',    react: '😢' },
  laugh:  { cat: 'laugh',  react: '😀' },
  dance:  { cat: 'dance',  react: '🕺' },
  stare:  { cat: 'stare',  react: '👀' },
};

const assert = require('assert');

let seq = 0;
function makeMessage(content, userId, opts = {}) {
  const sends = [];
  const message = {
    content,
    author: { id: userId, bot: false },
    guild: { id: 'soc_guild' },
    mentions: { users: { first: () => (opts.target ? { id: opts.target } : null) } },
    reactions: [],
    channel: { id: 'soc_chan', send(p) { sends.push(p); return Promise.resolve({ delete: () => Promise.resolve() }); } },
    react(e) { message.reactions.push(e); return Promise.resolve(message); },
  };
  message._sends = sends;
  return message;
}

(async () => {
await db.init();
handler.loadCommands();

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  — ${detail}`); }
};

const uid = () => 'soc_$' + (++seq);

console.log('\n== COMMANDS REGISTERED ==');
for (const name of Object.keys(EXPECT)) {
  const c = handler.getCommand(name);
  check(`command "${name}" loads with help entry`, c && c.helpCategory && c.description, JSON.stringify(c && { cat: c.helpCategory, desc: c.description }));
}

console.log('\n== GIF EMBED + REACTION PER COMMAND ==');
for (const [name, exp] of Object.entries(EXPECT)) {
  const id = uid();
  db.acceptTerms(id);
  const msg = makeMessage(`v ${name} @900000000000000001`, id, { target: '900000000000000001' });
  await handler.handleMessage(msg);
  const first = msg._sends[0];
  const payload = first ? (first.embeds ? first : null) : null;
  const img = payload && payload.embeds[0] ? payload.embeds[0]._image : null;
  const okUrl = img && /^https:\/\/raw\.githubusercontent\.com\/bre4d777\/anime-gifs\/master\//.test(img) && img.includes(`/${exp.cat}/`);
  check(`${name} posted a GIF embed from category "${exp.cat}"`, !!okUrl, String(img));
  check(`  ${name} reacted exactly once with ${exp.react}`, msg.reactions.length === 1 && msg.reactions[0] === exp.react, JSON.stringify(msg.reactions));
}

console.log('\n== SELF (no mention) BEHAVIOUR ==');
{
  const id = uid();
  db.acceptTerms(id);
  const msg = makeMessage('v hug', id);
  await handler.handleMessage(msg);
  const img = msg._sends[0] && msg._sends[0].embeds[0] ? msg._sends[0].embeds[0]._image : null;
  check('hug without mention still posts GIF (self line)', /hug\/\d+\.gif$/.test(img || ''), String(img));
  const text = (msg._sends[0] && msg._sends[0].content) || '';
  check('  self line mentions "emself"', /emself/.test(text), text);
}

console.log('\n== REACTION FAILURE IS NONFATAL ==');
{
  const id = uid();
  db.acceptTerms(id);
  const msg = makeMessage('v pat @900000000000000001', id, { target: '900000000000000001', failReact: true });
  await handler.handleMessage(msg);
  const img = msg._sends[0] && msg._sends[0].embeds[0] ? msg._sends[0].embeds[0]._image : null;
  check('react failure keeps the GIF embed', /pat\/\d+\.gif$/.test(img || ''), String(img));
  check('  and sends no error embed', !msg._sends.slice(1).some(s => s.embeds && s.embeds[0] && s.embeds[0]._title === 'Error'), JSON.stringify(msg._sends.slice(1).map(s => s.embeds && s.embeds[0] && s.embeds[0]._title)));
}

console.log('\n== social_used COUNTER + TITLE HOOK ==');
{
  const id = uid();
  db.acceptTerms(id);
  const r0 = db.exec(`SELECT social_used FROM users WHERE user_id = '${id}'`);
  const before = r0[0] && r0[0].values[0] ? r0[0].values[0][0] : 0;

  // first kiss → social_used +1 AND cuddle bug unlocks via the auto title hook
  const m1 = makeMessage('v kiss @900000000000000001', id, { target: '900000000000000001' });
  await handler.handleMessage(m1);
  const r1 = db.exec(`SELECT social_used FROM users WHERE user_id = '${id}'`);
  const after1 = r1[0] && r1[0].values[0] ? r1[0].values[0][0] : 0;
  check('one social run bumps social_used by exactly 1', after1 === before + 1, `before=${before} after=${after1}`);
  const m1Titles = m1._sends.map(s => (s.embeds && s.embeds[0] && (s.embeds[0]._title || '') + ' ' + (s.embeds[0]._fields || []).map(f => String(f.name || '') + ' ' + String(f.value || '')).join(' ')) || '').join(' | ');
  check('cuddle bug title unlocks via the social path', /cuddle bug/i.test(m1Titles), m1Titles.slice(0, 120));
  check('  GIF embed still posted first', /kiss\/\d+\.gif$/.test((m1._sends[0] && m1._sends[0].embeds[0] && m1._sends[0].embeds[0]._image) || ''), String(m1._sends[0] && m1._sends[0].embeds[0] && m1._sends[0].embeds[0]._image));

  // 4 more (respecting the 2s per-command cooldown) → influencer (>=5) unlocks
  let inflTitles = '';
  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 2100));
    const m = makeMessage('v kiss @900000000000000001', id, { target: '900000000000000001' });
    await handler.handleMessage(m);
    inflTitles += m._sends.map(s => (s.embeds && s.embeds[0] && (s.embeds[0]._title || '') + ' ' + (s.embeds[0]._fields || []).map(f => String(f.name || '') + ' ' + String(f.value || '')).join(' ')) || '').join(' | ');
  }
  const r5 = db.exec(`SELECT social_used FROM users WHERE user_id = '${id}'`);
  const after5 = r5[0] && r5[0].values[0] ? r5[0].values[0][0] : 0;
  check('5 spaced social runs → social_used 5', after5 === before + 5, `after=${after5}`);
  check('influencer title unlocks at 5 social uses', /influencer/i.test(inflTitles), inflTitles.slice(0, 160));
}

console.log('\n== NO DUPLICATES / UNIQUENESS of pools ==');
{
  const { gifsFor } = require('../commands/socialgifs');
  for (const [name, exp] of Object.entries(EXPECT)) {
    const set = new Set(gifsFor(name));
    check(`${name} pool has no duplicate URLs`, set.size === gifsFor(name).length, `size=${gifsFor(name).length} uniq=${set.size}`);
  }
}

const total = pass + fail;
console.log(`\n${pass}/${total} checks passed`);
if (fail) {
  console.log('FAILURES PRESENT');
  process.exit(1);
}
console.log('ALL SOCIAL COMMAND TESTS PASSED');
process.exit(0);
})();