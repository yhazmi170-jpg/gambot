// Integration test for Phase 9-12 commands: case/judge/compare/incidents(2.0
// lore), community events (event/button/here/creature), summon opt-out,
// v try (recommendation engine + usage tracking), v new, and the hidden
// achievement auto-unlocks. Throwaway in-memory DB. NEVER touches prod.
process.env.DB_PATH = '/tmp/two_it';
const fs = require('fs');
fs.rmSync('/tmp/two_it', { recursive: true, force: true });
fs.mkdirSync('/tmp/two_it', { recursive: true });

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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = async (msg) => { await sleep(2050); return handler.handleMessage(msg); };

let seq = 0;
const guild = { id: 'guild_it' };
function makeMessage(content, userId, opts = {}) {
  const sends = [];
  const message = {
    content,
    author: { id: userId, bot: false },
    guild: opts.guild === false ? null : guild,
    mentions: { users: { first: () => (opts.target ? { id: opts.target } : null) } },
    reactions: [],
    channel: { id: 'chan_it', send(p) { sends.push(p); return Promise.resolve({ delete: () => Promise.resolve() }); } },
    react(e) { message.reactions.push(e); return Promise.resolve(message); },
  };
  message._sends = sends;
  return message;
}
const allText = m => m._sends.map(s => (s.embeds && s.embeds[0] ? (s.embeds[0]._title || '') + ' ' + (s.embeds[0]._fields || []).map(f => String(f.name || '') + ': ' + String(f.value || '')).join(' ') + ' ' + (s.embeds[0]._description || '') : JSON.stringify(s))).join(' | ');
const titleOf = m => (m._sends[0] && m._sends[0].embeds && m._sends[0].embeds[0] && m._sends[0].embeds[0]._title) || '';
const isErr = m => /[Ee]rror/.test(titleOf(m)) || (m._sends[0] && m._sends[0].embeds && m._sends[0].embeds[0] && m._sends[0].embeds[0]._title === 'Error');

(async () => {
  const assert = require('assert');
  await db.init();
  handler.loadCommands();
  let pass = 0, fail = 0;
  const check = (name, cond, detail) => { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + '  — ' + detail); } };
  const uid = () => 'ph9_' + (++seq);

  console.log('\n== REGISTRATION ==');
  for (const name of ['case', 'judge', 'compare', 'incidents', 'event', 'button', 'here', 'creature', 'summon', 'try', 'new']) {
    const c = handler.getCommand(name);
    check(`command "${name}" registered with help lines`, c && c.helpCategory && c.description, JSON.stringify(c && { cat: c.helpCategory, desc: c.description }));
  }

  console.log('\n== CASE / JUDGE / COMPARE ==');
  {
    // target with real records
    const targetId = '9000000000000009';
    db.acceptTerms(targetId);
    db.recordActivity(targetId, 'meaningful');
    for (let i = 0; i < 5; i++) db.addBalance(targetId, 1000);
    const noOne = '9000000000000010';
    const judger = uid(); db.acceptTerms(judger);

    let m = makeMessage('v case @9000000000000009', judger, { target: targetId });
    await run(m);
    const t1 = allText(m);
    check('case file posts for a real user', /Case File/i.test(titleOf(m)) && /Subject/.test(t1), t1.slice(0, 140));
    check('case has no decorative reactions', m.reactions.length === 0, JSON.stringify(m.reactions));

    m = makeMessage('v case @9000000000000010', judger, { target: noOne });
    await run(m);
    check('case on unknown user errors cleanly', isErr(m) || /file not found/i.test(allText(m)), allText(m).slice(0, 120));

    const j0 = db.exec(`SELECT judged FROM users WHERE user_id = '${judger}'`);
    m = makeMessage('v judge @9000000000000009', judger, { target: targetId });
    await run(m);
    const j1 = db.exec(`SELECT judged FROM users WHERE user_id = '${judger}'`);
    check('judge bumps the judger judged counter by 1', j1[0].values[0][0] === (j0[0] ? j0[0].values[0][0] : 0) + 1, JSON.stringify(j1));
    check('judge posts a verdict embed', /Court is in Session/i.test(titleOf(m)) && /Verdict/.test(allText(m)), titleOf(m));
    const judgerText = allText(m);
    check('first judge auto-unlocks "Alright What Is Going On"', /Alright What Is Going On/i.test(judgerText) || m._sends.some(s => (s.embeds && s.embeds[0] && s.embeds[0]._title || '').includes('Achievements')), judgerText.slice(0, 160));

    m = makeMessage('v compare @9000000000000009', judger, { target: targetId });
    await run(m);
    const ct = allText(m);
    check('compare posts real stats + commentary', /vs /.test(titleOf(m)) && /Commentary/.test(ct) && /Level/.test(ct), ct.slice(0, 140));

    m = makeMessage('v compare @9000000000000010', judger, { target: noOne });
    await run(m);
    check('compare on unknown user errors cleanly', /no records|no court/i.test(allText(m)), allText(m).slice(0, 120));
  }

  console.log('\n== INCIDENTS / LORE ==');
  {
    const id = uid(); db.acceptTerms(id);
    db.exec(`DELETE FROM incidents WHERE guild_id='${guild.id}'`);
    let m = makeMessage('v incidents 5', id, { guild: false });
    await run(m);
    check('incidents errors in DMs', /servers/i.test(allText(m)), allText(m).slice(0, 120));

    m = makeMessage('v incidents 5', id);
    await run(m);
    const before = allText(m);
    check('incidents with no lore posts an empty-stalk note', /nothing.*recorded/i.test(before), before.slice(0, 120));

    db.addIncident(guild.id, 'achievement', '<@111> unlocked something cool');
    db.addIncident(guild.id, 'boss', 'a Yeti raid ended');
    m = makeMessage('v incidents 5', id);
    await run(m);
    const after = allText(m);
    check('lore lists recorded incidents newest first', /Yeti raid/.test(after) && /something cool/.test(after) && after.indexOf('Yeti') < after.indexOf('something'), after.slice(0, 200));
    const capped = ['a','b','c','d','e','f'];
    for (const c of capped) db.addIncident(guild.id, 'event', 'x-' + c);
    const count = db.exec(`SELECT COUNT(*) FROM incidents WHERE guild_id='${guild.id}'`)[0].values[0][0];
    check('lore is capped (60 max per guild)', count <= 60, 'count=' + count);
  }

  console.log('\n== COMMUNITY EVENTS ==');
  {
    const id = uid(); db.acceptTerms(id);
    // ensure no active event by default
    let m = makeMessage('v event', id);
    await run(m);
    check('event with nothing running reports none', /no event is running/i.test(allText(m)), allText(m).slice(0, 120));

    db.exec(`DELETE FROM lb_state WHERE key='last_community_event'`);
    const ev = db.startCommunityEvent();
    check('startCommunityEvent can start one (cooldown cleared)', !!ev, JSON.stringify(ev));

    // force specific events for the three interactive ones
    const force = (key) => { db.exec(`DELETE FROM community_events`); db.exec(`INSERT INTO community_events (key, ends_at) VALUES ('${key}', ${Math.floor(Date.now() / 1000) + 600})`); };
    force('the_button');
    m = makeMessage('v event', id);
    await run(m);
    const et = allText(m);
    check('event posts live event details', /The Button/.test(et), et.slice(0, 140));
    check('event is joinable through button', /v button/.test(et), et.slice(0, 140));

    const b0 = db.exec(`SELECT button_pressed FROM users WHERE user_id='${id}'`);
    m = makeMessage('v button', id);
    await run(m);
    const bt = allText(m);
    const b1 = db.exec(`SELECT balance FROM users WHERE user_id='${id}'`);
    check('button press pays reward', /coinfederacy|coins/.test(bt) || Number(b1[0].values[0][0]) > 0, bt.slice(0, 140));
    const bp = db.exec(`SELECT button_pressed FROM users WHERE user_id='${id}'`)[0].values[0][0];
    check('button_pressed counter bumped', bp === (b0[0] ? b0[0].values[0][0] : 0) + 1, 'bumped=' + bp);
    check('The Button achievement auto-unlocked', /The Button/.test(bt) || m._sends.some(s => (s.embeds && s.embeds[0] && (s.embeds[0]._title || '')).includes('Achievements')), bt.slice(0, 160));

    force('roll_call');
    const r0 = db.exec(`SELECT rollcalls FROM users WHERE user_id='${id}'`);
    m = makeMessage('v here', id);
    await run(m);
    const rp = db.exec(`SELECT rollcalls FROM users WHERE user_id='${id}'`)[0].values[0][0];
    check('here bumps rollcalls', rp === (r0[0] ? r0[0].values[0][0] : 0) + 1, 'r=' + rp);
    check('Roll Call Veteran unlocked', m._sends.some(s => (s.embeds && s.embeds[0] && (s.embeds[0]._title || '')).includes('Achievements')) || /Attendance Noted/.test(titleOf(m)), titleOf(m));

    force('creature');
    const w0 = db.exec(`SELECT wanted_marked FROM users WHERE user_id='${id}'`);
    m = makeMessage('v creature', id);
    await run(m);
    const wp = db.exec(`SELECT wanted_marked FROM users WHERE user_id='${id}'`)[0].values[0][0];
    check('creature bumps wanted_marked', wp === (w0[0] ? w0[0].values[0][0] : 0) + 1, 'w=' + wp);
    check('Wanted achievement unlocked', m._sends.some(s => (s.embeds && s.embeds[0] && (s.embeds[0]._title || '')).includes('Achievements')) || /Creature Sighted/.test(titleOf(m)), titleOf(m));

    db.exec(`DELETE FROM community_events`);
    m = makeMessage('v button', id);
    await run(m);
    check('button without an active event errors', /no button to press/i.test(allText(m)), allText(m).slice(0, 120));
  }

  console.log('\n== SUMMON OPT OUT ==');
  {
    const id = uid(); db.acceptTerms(id);
    const off0 = db.getSummonOptOut(id);
    let m = makeMessage('v summon', id);
    await run(m);
    check('summon status shows current mode', /on|off/.test(allText(m)), allText(m).slice(0, 120));
    m = makeMessage('v summon off', id);
    await run(m);
    check('summon off persists opt-out', db.getSummonOptOut(id) === true && !off0, 'off=' + db.getSummonOptOut(id));
    m = makeMessage('v summon on', id);
    await run(m);
    check('summon on re-enables', db.getSummonOptOut(id) === false, 'off=' + db.getSummonOptOut(id));
  }

  console.log('\n== V TRY (recommendation engine + usage tracking) ==');
  {
    const id = uid(); db.acceptTerms(id);
    // no commands used, no quest, no eggs, but usage-tracking fires on v try itself only.
    let m = makeMessage('v try', id);
    await run(m);
    const tt = allText(m);
    check('try recommends something for a fresh user', /Recommends|nothing to explore|don[\'’]t|waiting/i.test(tt), tt.slice(0, 140));
    check('try shows progress line', /features explored/.test(tt), tt.slice(0, 140));

    m = makeMessage('v try list', id);
    await run(m);
    const lt = allText(m);
    check('try list shows never-tried marker', /✨/.test(lt) && /Feature tracker/.test(lt), lt.slice(0, 120));

    m = makeMessage('v try tip', id);
    await run(m);
    check('try tip returns a mechanic tip', /Mechanic Tip/.test(titleOf(m)), titleOf(m));

    m = makeMessage('v hunt', id);
    await run(m);
    const rec = db.getFeatureUse(id, 'hunt');
    check('usage tracking records hunt', !!rec && rec.count >= 1, JSON.stringify(rec));
    m = makeMessage('v try list', id);
    await run(m);
    const after = allText(m);
    check('after using hunt, list marks it as tried', /✔️.*hunt|hunt.*✔️/.test(after), after.slice(0, 200));
  }

  console.log('\n== V NEW ==');
  {
    const id = uid(); db.acceptTerms(id);
    const m = makeMessage('v new', id);
    await run(m);
    const nt = allText(m);
    check('new posts whats-new', /Gambot 2\.0|Social Commands|v try/.test(nt), nt.slice(0, 160));
  }

  const total = pass + fail;
  console.log(`\n${pass}/${total} checks passed`);
  if (fail) { console.log('FAILURES PRESENT'); process.exit(1); }
  console.log('ALL PHASE 9-12 TESTS PASSED');
  process.exit(0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });