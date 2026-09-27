// smoke_all_commands.js — systematic runtime sweep of EVERY registered command.
// Reuses the REAL commandHandler pipeline (prefix parse -> disabled checks -> TOS
// -> cooldown -> ensureUser -> summon/activity/achievement/title hooks -> execute)
// against an isolated DB seeded with fresh + legacy-shaped fixtures.
//
// Classification:
//   PASS       replied without an Error-embed
//   EXPECTED   replied with a user-facing Error embed (usage/cooldown/needs-args…) — NOT a bug
//   INTERACTIVE command arms component collectors / button flows (needs real Discord)
//   OWNER-ONLY admin-gated command (reply confirms the owner gate)
//   FAIL       threw / rejected with an internal exception — real bug
//
// Run: DB=$(mktemp -d) node scripts/smoke_all_commands.js
process.env.DB_PATH = process.env.SMOKE_DB || '/tmp/smoke_cmd_db';
const fs = require('fs');
fs.rmSync(process.env.DB_PATH, { recursive: true, force: true });
fs.mkdirSync(process.env.DB_PATH, { recursive: true });

const path = require('path');
const config = require('../config');
const db = require('../db');
const { Collection } = require('discord.js');
const { loadCommands, getCommand, handleMessage } = require('../utils/commandHandler');
const { embed, error } = require('../utils/embed');

const TESTUSER = '111111111111111111'; // non-owner rich fresh user
const OWNER = config.ownerId;
const TARGET = '222222222222222222';
const PLAYER2 = '333333333333333333';
const LEGACY = '444444444444444444';
const LEGACY2 = '555555555555555555'; // has pets, no bank, uppercase/SECRET rarities

const results = new Map();
const replies = new Map(); // cmd -> last embed text
let seq = 0;

function makeCollectorHooks() {
  const armed = { collector: false };
  return {
    armed,
    collector: {
      on() {}, once() {}, off() {}, stop() {},
      onCollect() {}, onEnd() {}, end() {}, [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; },
    },
  };
}

function makeFakeSent(gh) {
  const armed = gh.armed;
  return {
    id: 'm' + (++seq),
    content: '',
    embeds: [],
    components: [],
    _gh: gh,
    edit: (p) => { recordPayload(p); return Promise.resolve(this); },
    delete: () => Promise.resolve(),
    react: () => Promise.resolve(),
    createMessageComponentCollector: () => { armed.collector = true; return gh.collector; },
    awaitMessageComponent: () => { armed.collector = true; return new Promise(() => {}); },
    reply: (p) => { recordPayload(p); return Promise.resolve(this); },
    fetch: () => Promise.resolve(this),
  };
}

function recordPayload(p) {
  if (!p) return;
  const e = (p.embeds && p.embeds[0]) || (p && p._embed);
  let text = '';
  if (e) {
    text = String(e.data && e.data.title ? e.data.title + ' ' : (e.title || ''));
    if (e.data && Array.isArray(e.data.fields)) text += e.data.fields.map(f => `${f.name}: ${f.value}`).join(' | ');
    if (e.data && e.data.description) text += ' | ' + e.data.description;
    if (e.title) text += ' ' + (e.description || '');
  }
  if (p.content) text += ' content=' + String(p.content).slice(0, 40);
  const r = text;
  if (ri) ri.push(r);
}

let ri = null;

function targetUser() {
  return { id: TARGET, bot: false, username: 'SmokeTarget', tag: 'SmokeTarget#0001', displayName: 'SmokeTarget', send: () => Promise.resolve() };
}

function makeMessage(userId, cmdName, args, opts = {}) {
  ri = results.get(cmdName) || (results.set(cmdName, []), results.get(cmdName));
  const content = 'v ' + cmdName + (args.length ? ' ' + args.join(' ') : '');
  const gh = makeCollectorHooks();
  const sent = makeFakeSent(gh);
  const fakeMsgObj = {
    id: 'msg' + (++seq),
    createMessageComponentCollector: () => { gh.armed.collector = true; gh.armed.collector = gh.collector; return gh.collector; },
    awaitMessageComponent: () => { gh.armed.collector = true; return new Promise(() => {}); },
  };
  const author = {
    id: userId, bot: false, username: 'SmokeUser', tag: 'SmokeUser#0001', displayName: 'SmokeUser',
    toString: () => `<@${userId}>`, send: (p) => { recordPayload(p); return Promise.resolve(sent); },
  };
  const membersCache = new Collection();
  membersCache.set(TARGET, { id: TARGET, displayName: 'SmokeTarget', nickname: null });
  membersCache.set(userId, { id: userId, displayName: 'SmokeUser', nickname: null });
  const guild = {
    id: opts.guildId || 'g_smoke', name: 'Smoke Guild', memberCount: membersCache.size,
    members: {
      cache: membersCache,
      fetch: () => Promise.resolve(membersCache),
      resolve: (id) => membersCache.get(id) || null,
    },
    roles: { cache: new Collection(), fetch: () => Promise.resolve({}) },
    emojis: { cache: new Collection(), fetch: () => Promise.resolve({}) },
    channels: { cache: new Collection() },
    fetchMembers: () => Promise.resolve(),
    fetch: () => Promise.resolve(guild),
  };
  const channel = {
    id: 'c_smoke', name: 'general', type: 0, guild,
    send: (p) => { recordPayload(p); return Promise.resolve(sent); },
    reply: (p) => { recordPayload(p); return Promise.resolve(sent); },
    messages: null, lastMessageId: '0',
    createMessageComponentCollector: () => { gh.armed.collector = true; gh.armed.collector = gh.collector; return gh.collector; },
    createMessageCollector: () => { gh.armed.collector = true; gh.armed.collector = gh.collector; return gh.collector; },
    createMessageComponentCollectorOriginal: () => gh.armed.collector,
  };
  sent.channel = channel;
  const member = { id: userId, guild, displayName: author.username, roles: { cache: new Collection(), has: () => false }, permissions: null, nickname: null };
  const msg = {
    author, member, guild, channel, content,
    id: fakeMsgObj.id,
    createMessageComponentCollector: fakeMsgObj.createMessageComponentCollector.bind(fakeMsgObj),
    awaitMessageComponent: fakeMsgObj.awaitMessageComponent.bind(fakeMsgObj),
    cleanContent: content, createdAt: new Date(), createdTimestamp: Date.now(),
    mentions: {
      users: { first: () => targetUser() }, roles: { first: () => null }, channels: { first: () => null }, everyone: false,
    },
    reply: channel.send.bind(channel),
    react: () => Promise.resolve(),
    guildId: guild.id, channelId: channel.id,
    client: { user: { id: 'gbot', send: () => Promise.resolve() }, guilds: { cache: new Collection() }, users: { cache: new Collection() }, channels: { cache: new Collection() } },
    _gh: gh,
  };
  Object.assign(sent, { author, channel, guild, content, mentions: msg.mentions });
  return msg;
}

async function timeoutRace(promise, ms, tag) {
  let t;
  const to = new Promise((res) => { t = setTimeout(() => res({ timed: true }), ms); });
  const out = await Promise.race([promise.then(r => ({ ok: true, r })), to]);
  clearTimeout(t);
  return out;
}

async function seed() {
  await db.init();
  // rich fresh user
  db.exec(`INSERT INTO users (user_id, balance, bank, essence, gems, xp, level, terms_accepted, insurance, lucky, god_luck, created_at)
           VALUES ('${TESTUSER}', 500000000, 50000000, 500, 50, 0, 1, 1, 2, 0, 0, 0)`);
  db.exec(`INSERT INTO users (user_id, balance, bank, gems, essence, level, xp, terms_accepted)
           VALUES ('${TARGET}', 25000000, 1000000, 10, 10, 5, 100, 1)`);
  db.exec(`INSERT INTO users (user_id, balance, bank, gems, essence, level, xp, terms_accepted)
           VALUES ('${PLAYER2}', 10000000, 0, 0, 0, 2, 40, 1)`);
  // legacy-shaped user: uppercase rarities + SECRET + ms timestamps + big stats
  db.exec(`INSERT INTO users (user_id, balance, bank, gems, essence, level, xp, terms_accepted, insurance, credit_score, total_gambled, total_won)
           VALUES ('${LEGACY}', 999999999, 500000000, 999, 88, 99, 999999, 1, 3, 700, 999999, 999999)`);
  db.exec(`INSERT INTO users (user_id, balance, bank, gems, essence, level, xp, terms_accepted)
           VALUES ('${LEGACY2}', 5000, 0, 0, 0, 1, 0, 1)`);
  // teams
  db.exec(`INSERT INTO teams (user_id, slot1, slot2, slot3) VALUES ('${TESTUSER}', 9001, 9002, 0)`);
  db.exec(`INSERT INTO teams (user_id, slot1, slot2, slot3) VALUES ('${LEGACY}', 9009, 0, 0)`);
  // fresh-format animals
  db.exec(`INSERT INTO animals (id, user_id, species, rarity, name, level, exp, hp, max_hp, attack, defense, created_at, shiny, trait, fed_until, bond)
           VALUES (9001,'${TESTUSER}','Cat','legendary','Fluffy',10,50,200,200,40,30,1700000000,0,'Brave',0,5),
                  (9002,'${TESTUSER}','Wolf','epic','Luna',5,10,150,150,30,25,1700000000,1,'Eager',0,2),
                  (9003,'${TESTUSER}','Fish','common','Bubbles',1,0,100,100,10,5,1700000000,0,'Calm',0,0),
                  (9004,'${TESTUSER}','Dragon','mythic','Ember',20,0,500,500,80,60,1700000000,0,'Bold',0,8),
                  (9005,'${TESTUSER}','Slime','rare','Goo',3,0,120,120,22,18,1700000000,0,'Quick',0,0),
                  (9006,'${TESTUSER}','Frog','uncommon','Ribbit',2,0,110,110,15,20,1700000000,0,'Calm',0,0),
                  (9007,'${TESTUSER}','Rabbit','rare','Thumper',4,0,130,130,25,20,1700000000,0,'Brave',0,0),
                  (9008,'${TESTUSER}','Fox','legendary','Rusty',6,0,180,180,35,30,1700000000,0,'Eager',0,0)`);
  // legacy-format animals: uppercase rarities (import artifact) + SECRET + ms timestamps
  db.exec(`INSERT INTO animals (id, user_id, species, rarity, name, level, exp, hp, max_hp, attack, defense, created_at, shiny, trait, fed_until, bond)
           VALUES (9009,'${LEGACY}','Griffin','COMMON','OldG',1,0,100,100,10,5,1753455600000,0,'Brave',0,0),
                  (9010,'${LEGACY}','Phoenix','SECRET','Myst',50,0,999,999,100,80,1753455600000,0,'Calm',0,0),
                  (9011,'${LEGACY}','Panda','MYTHIC','BigM',30,0,600,600,90,70,1753455600000,0,'Eager',0,0),
                  (9012,'${LEGACY}','Turtle','EPIC','Shell',7,0,300,300,40,50,1753455600000,0,'Bold',0,0)`);
  db.exec(`INSERT INTO animals (id, user_id, species, rarity, name, level, exp, hp, max_hp, attack, defense, created_at, shiny, trait, fed_until, bond)
           VALUES (9013,'${LEGACY2}','Mouse','common','Squeak',1,0,100,100,10,5,1700000000,0,'Calm',0,0)`);
  // loot/gems/eggs/weapon state for the rich user
  db.exec(`INSERT INTO weapon_crates (user_id, qty) VALUES ('${TESTUSER}', 3)`);
  db.exec(`INSERT INTO weapons_inv (id, user_id, type, rarity, quality, level) VALUES (1,'${TESTUSER}','great_sword','rare',80,1),
                                                                                     (2,'${TESTUSER}','heal_staff','common',70,1)`);
  db.exec(`INSERT INTO animals_weapon (animal_id, weapon_id) VALUES (9001, 1)`);
  // inbox delivery (unclaimed money), purchases, guilds
  db.exec(`INSERT INTO inbox_deliveries (recipient_id, sender_id, source, label, amount, payload, status, created_at)
           VALUES ('${TESTUSER}', '_test_', 'giveaway', 'Smoke gift', 123456, '{"gw":"smoke1"}', 'pending', 1700000000)`);
  db.exec(`INSERT INTO purchases (user_id, perk, expires_at) VALUES ('${TESTUSER}', 'rob', 0)`);
  db.exec(`INSERT INTO guilds (guild_id, disabled_commands) VALUES ('g_smoke', '[]')`);
  // checklist/pass/quest tables for rich user
  db.exec(`INSERT INTO battlepass (user_id, season, xp, premium, free_claimed, prem_claimed) VALUES ('${TESTUSER}', 1, 50, 0, '', '')`);
  // contracts / events / black market
  db.exec(`INSERT INTO merchant_state (id, next_at) VALUES (1, 0)`);
  // a community event in progress for progress hooks
  db.exec(`INSERT INTO community_events (key, ends_at) VALUES ('great_hunt', 9999999999)`);
  db.exec(`INSERT INTO community_event_progress (guild_id, key, progress, goal, contributors, rewarded) VALUES ('g_smoke', 'great_hunt', 10, 80, '', 0)`);
}

// ---- per-command safe sample args (best-effort; default [] triggers usage paths) ----
const ARGS = {
  bal: [], cash: [], bank: ['balance'], profile: [], lb: [], leaderboard: [], slb: [], glb: [], toulb: [], toulbonline: [],
  daily: [], weekly: [], streak: [], work: [], rep: ['@222222222222222222', 'nice'], pray: [], freebet: [], here: [], level: [], activity: [], version: [], help: [], perkhelp: [], gamehelp: [], incidents: [], lore: [],
  coinflip: ['100'], cf: ['100', 'heads'], dice: ['100'], roll: ['100'], roulette: ['100'], crash: ['100', '2'], slots: ['100'], mines: ['100', '3'], lottery: ['2'], wheel: ['100'], poker: [], try: ['all'],
  gamble: ['100'], blackjack: ['100'], bj: ['100'], snailgarden: ['100'], sg: ['100'], garden: [], gardenshop: [], gardenbuy: ['soil'], gardenpet: ['snail'],
  hunt: ['2'], zoo: [], team: [], sacrifice: ['all'], hatch: [], sell: ['all'], upgrade: ['efficiency'], huntbot: [], autohuntbot: [], autohunt: ['5'], givepets: ['@222222222222222222', '9003'],
  weapon: ['list'], weaponcrate: ['open', 'all'], wc: ['open', 'all'], animal: ['9001'], rename: ['9001', 'NewName'], evolve: ['9001'],
  giveaway: ['1000', '5m'], give: ['@222222222222222222', '10000'], rob: ['@222222222222222222'], steal: ['@222222222222222222'], duel: ['@222222222222222222', '10000'], raid: [],
  hug: ['@222222222222222222'], kiss: ['@222222222222222222'], slap: ['@222222222222222222'], pat: ['@222222222222222222'], cuddle: ['@222222222222222222'],
  bite: ['@222222222222222222'], punch: ['@222222222222222222'], lick: ['@222222222222222222'], kill: ['@222222222222222222'],
  quest: [], bounty: [], achievements: [], title: [], contract: [], checklist: ['claim'], battlepass: [], pass: [], bp: [], season: [],
  vault: ['balance'], merchant: [], blackmarket: [], stock: [], stocks: [], auction: [], bid: ['1', '1000'],
  clan: ['info'], clanwar: [], marry: ['@222222222222222222'], family: [], socket: [], plot: [], event: [], judge: ['@222222222222222222'], summon: [],
  crate: ['open', '1'], blackmarket: [], zoo: [], zooshop: [], here: [], incidents: [], streak: [], lucky: [], luckylist: [], alucky: ['@222222222222222222'],
  // admin
  add: ['@222222222222222222', '1000'], remove: ['@222222222222222222', '100'], bal: ['@222222222222222222'], reward: ['@222222222222222222', '1000'], removereward: ['@222222222222222222'],
  shutdown: [], restart: [], cmds: [], customrole: ['create', 'Test'], setbadge: ['🔥'], setlb: ['💎'], autoreact: ['⭐'], avatar: [], banner: [], compare: [], case: [],
  pokertournament: ['1000'], tournament: ['1000'], heist: ['1000'], race: ['1000'], battle: [], lotto: [], gift: ['@222222222222222222', '1000'],
  inbox: ['claim', 'all'], giveaway: ['1000', '10'],
  tos: [], agree: [], disable: ['bal'], enable: ['bal'], new: [], customrole: ['create', 'CoolRole'], notifyperk: [], petgpt: [], grassping: [],
};

const OWNER_ONLY = ['add', 'remove', 'reward', 'removereward', 'shutdown', 'restart', 'cmds', 'alucky', 'luckylist', 'lucky', 'disable', 'enable', 'new', 'notifyperk', 'admin', 'gain', 'reroll', 'customrole'];
const OWNER_ALIASES = new Set(['add', 'gift', 'cockfarm', 'admin']);

async function runOne(cmdName, args, userOverride) {
  const userId = userOverride || TESTUSER;
  const msg = makeMessage(userId, cmdName, args);
  let status = '?', detail = '';
  const out = await timeoutRace((async () => {
    try {
      await handleMessage(msg);
      return 'handled';
    } catch (e) {
      detail = (e && e.message) || String(e);
      return 'throw:' + detail;
    }
  })(), 4500, cmdName);
  if (out.timed) { status = 'TIMEOUT'; }
  else if (String(out.r).startsWith('throw:')) { status = 'FAIL'; detail = String(out.r).slice(6); }
  else {
    // decide from replies captured in `ri`
    const errText = (results.get(cmdName) || []).join(' | ');
    if (/you can(t|‘t) | need | must | no bots|mentions?|target|amount|invalid|cooldown|wait \*\*|disabled|not enough|too many|smaller|larger|can’t|can’t|closed|expired|already|pick|choose|provide|there’s no|no pets|empty|first|reserved for the bot owner|aren’t allowed|require a |requires a |must provide/i.test(errText)) {
      status = errText.includes('reserved for the bot owner') ? 'OWNER-ONLY' : 'EXPECTED';
    } else {
      status = 'PASS';
    }
  }
  replies.set(cmdName, (results.get(cmdName) || []).join(' ║ ').slice(0, 400));
  results.delete(cmdName);
  return { cmd: cmdName, status, detail, owner: OWNER_ONLY.includes(cmdName) };
}

(async () => {
  await seed();
  loadCommands();

  const files = fs.readdirSync(path.join(__dirname, '..', 'commands')).filter(f => f.endsWith('.js'));
  const all = [];
  const seen = new Set();
  for (const f of files) {
    const mod = require(path.join(__dirname, '..', 'commands', f));
    if (!mod || !mod.name) continue;
    if (seen.has(mod.name)) continue;
    seen.add(mod.name);
    all.push({ name: mod.name, aliases: mod.aliases || [] });
  }
  all.sort((a, b) => a.name.localeCompare(b.name));

  const out = [];
  for (const { name } of all) {
    const args = ARGS[name] || [];
    const r = await runOne(name, args);
    out.push(r);
  }
  // owner-only commands also exercised as the owner (isolated DB)
  const outOwner = [];
  for (const { name } of all) {
    if (OWNER_ONLY.includes(name)) {
      const r = await runOne(name, ARGS[name] || [], OWNER);
      r.owner = true;
      outOwner.push(r);
    }
  }

  console.log('\n=== COMMAND SMOKE MATRIX (non-owner) ===');
  for (const r of out) console.log(`${r.status.padEnd(10)} ${r.cmd.padEnd(22)} ${r.detail ? r.detail.slice(0, 160) : ''}`);
  if (process.env.DUMP_REPLIES) {
    console.log('\n=== REPLY TEXT (non-PASS) ===');
    for (const r of out) {
      if (r.status !== 'PASS') console.log(`[${r.status}] ${r.cmd}: ${String(replies.get(r.cmd) || '').slice(0, 220)}`);
    }
  }
  if (outOwner.length) {
    console.log('\n=== OWNER-ONLY RE-RUN AS OWNER ===');
    for (const r of outOwner) console.log(`${r.status.padEnd(10)} ${r.cmd.padEnd(22)} ${r.detail ? r.detail.slice(0, 160) : ''}`);
  }
  const fail = out.filter(r => r.status === 'FAIL');
  const to = out.filter(r => r.status === 'TIMEOUT');
  const pass = out.filter(r => r.status === 'PASS');
  const exp = out.filter(r => r.status === 'EXPECTED');
  const own = out.filter(r => r.status === 'OWNER-ONLY');
  console.log('\n=== SUMMARY ===');
  console.log(`REGISTERED: ${all.length}`);
  console.log(`PASS: ${pass.length} | EXPECTED: ${exp.length} | OWNER-ONLY: ${own.length} | TIMEOUT/INTERACTIVE: ${to.length} | FAIL: ${fail.length}`);
  for (const r of fail) console.log(`  FAIL ${r.cmd}: ${r.detail.slice(0, 300)}`);
  for (const r of to) console.log(`  TIMEOUT ${r.cmd}`);
  if (outOwner.length) {
    const ofail = outOwner.filter(r => r.status === 'FAIL');
    console.log(`\nOWNER-ONLY AS OWNER: ${outOwner.length - ofail.length} ok, ${ofail.length} FAIL`);
    for (const r of ofail) console.log(`  FAIL ${r.cmd}: ${r.detail.slice(0, 300)}`);
  }
  process.exit(0);
})().catch(e => { console.error('HARNESS CRASH:', e && e.stack); process.exit(1); });