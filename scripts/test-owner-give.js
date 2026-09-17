// Integration test for the owner-give approval flow.
// Drives the REAL command handler for `v give` and the REAL handleInteraction
// for the owner DM buttons (keep / decline / mute). Fresh throwaway DB.
process.env.DB_PATH = '/tmp/ogive_it';
const fs = require('fs');
fs.rmSync('/tmp/ogive_it', { recursive: true, force: true });
fs.mkdirSync('/tmp/ogive_it', { recursive: true });

// --- discord.js stub with real-shaped builders ---------------------------------
class StubEmbed {
  constructor() { this._title = ''; this._color = 0; this._description = ''; this._fields = []; }
  setColor(c) { this._color = c; return this; }
  setTitle(t) { this._title = t; return this; }
  setDescription(d) { this._description = d; return this; }
  addFields(f) { (Array.isArray(f) ? f : [f]).forEach(x => this._fields.push({ name: x.name, value: x.value, inline: !!x.inline })); return this; }
  get data() { return { title: this._title, color: this._color, description: this._description, fields: this._fields }; }
}
class StubButton {
  constructor() { this._customId = ''; this._label = ''; this._style = 0; }
  setCustomId(v) { this._customId = v; return this; }
  setLabel(v) { this._label = v; return this; }
  setStyle(v) { this._style = v; return this; }
  setEmoji() { return this; }
  get data() { return { custom_id: this._customId, label: this._label, style: this._style }; }
}
class StubActionRow {
  constructor() { this._components = []; }
  addComponents(...cs) { this._components.push(...cs); return this; }
  get components() { return this._components; }
  get data() { return { components: this._components.map(c => c.data) }; }
}
function genericBuilder() {
  const target = {};
  const proxy = new Proxy(target, {
    get(t, p) {
      if (p === 'then') return undefined;
      if (p === 'data') return Object.assign({}, t);
      if (!(p in t)) t[p] = () => proxy;
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  return proxy;
}
const discordStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'ButtonStyle') return { Primary: 1, Secondary: 2, Success: 3, Danger: 4 };
    if (prop === 'PermissionFlagsBits') return new Proxy({}, { get: () => 0n });
    if (prop === 'Collection') return class extends Map {};
    if (prop === 'EmbedBuilder') return StubEmbed;
    if (prop === 'ButtonBuilder') return StubButton;
    if (prop === 'ActionRowBuilder') return StubActionRow;
    return function Stub() { return genericBuilder(); };
  },
});
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') return discordStub;
  return origLoad.apply(this, arguments);
};

// Cooldowns are not under test here — silence them BEFORE commandHandler is
// loaded (commandHandler destructures checkCooldown at require time).
const cooldownsMod = require('../utils/cooldowns');
cooldownsMod.checkCooldown = () => 0;

const db = require('../db');
const handler = require('../utils/commandHandler');
const config = require('../config');
const give = require('../commands/give');
const OWNER = config.ownerId || '536278876247162882';

const dms = [];
const dmMsgs = [];
const confirmMsgs = [];

let seq = 0;
const uid = () => 'og_it_' + (++seq);

function tick() { return new Promise(res => setTimeout(res, 0)); }

async function makeMessage(content, userId) {
  const sends = [];
  let confirmMsg = null;
  const mentionsFirst = content.includes(`<@${OWNER}>`)
    ? { id: OWNER }
    : content.includes('@otherUser') ? { id: 'other_user_9' } : { id: uid() };
  const msg = {
    content,
    author: { id: userId, bot: false },
    guild: null,
    mentions: { users: { first: () => mentionsFirst } },
    client: {
      users: {
        fetch: async (id) => ({
          id,
          send: async (payload) => {
            dms.push(payload);
            const dm = { id: 'dm' + (dmMsgs.length + 1), deleted: false, edits: [], edit: async (e) => { dm.edits.push(e); return dm; } };
            dmMsgs.push(dm);
            return dm;
          },
        }),
      },
    },
    channel: {
      id: 'chan_it',
      send: async (payload) => {
        sends.push(payload);
        const m = { id: 'confirm' + (confirmMsgs.length + 1), editable: true, edits: [], edit: async (e) => { m.edits.push(e); return m; } };
        m.createMessageComponentCollector = () => {
          const col = {};
          col.on = (ev, cb) => { if (ev === 'collect') col._collect = cb; if (ev === 'end') col._end = cb; };
          m._lastCollector = col;
          return col;
        };
        confirmMsg = m;
        confirmMsgs.push(m);
        return m;
      },
    },
    _sends: sends,
    get confirmMsg() { return confirmMsg; },
  };
  return msg;
}

async function confirmGive(msg, userId) {
  for (let n = 0; n < 50 && (!msg.confirmMsg || !msg.confirmMsg._lastCollector); n++) await tick();
  const col = msg.confirmMsg && msg.confirmMsg._lastCollector;
  if (!col) throw new Error('no collector after waiting: confirmMsg=' + !!msg.confirmMsg);
  await tick();
  await col._collect({ user: { id: userId }, customId: 'give_confirm', update: async (p) => { msg.confirmMsg.lastUpdate = p; } });
  await tick();
  await tick();
}

function setOwnerBalance(x) {
  db.addBalance(OWNER, x - db.ensureUser(OWNER).balance);
}

(async () => {
  await db.init();
  handler.loadCommands();

  db.addBalance(OWNER, 100000); // ensure the owner has an account
  const results = [];
  const check = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  console.log('== GIVE TO NORMAL USER (no owner interference) ==');
  const a = uid();
  db.acceptTerms(a);
  db.addBalance(a, 1000);
  let msg = await makeMessage('v give @otherUser 100', a);
  await handler.handleMessage(msg);
  check('normal give still shows confirm dialog', msg._sends.length === 1 && msg.confirmMsg !== null && dms.length === 0, `sends=${msg._sends.length} dms=${dms.length}`);

  console.log('\n== GIVE TO OWNER -> OWNER DM APPROVAL EMBED (owner only) ==');
  const b = uid();
  db.acceptTerms(b);
  db.addBalance(b, 1000);
  const ownerBeforeB = db.ensureUser(OWNER).balance;
  const bBefore = db.ensureUser(b).balance;
  msg = await makeMessage(`v give <@${OWNER}> 50`, b);
  await handler.handleMessage(msg);
  check('confirm dialog shown to giver', msg._sends.length === 1 && msg.confirmMsg !== null, `sends=${msg._sends.length}`);
  const dmsAftConfirmB = dms.length;
  check('no owner DM before confirm click', dms.length === 0, `dms=${dms.length}`);
  await confirmGive(msg, b);
  check('transfer completed on confirm (owner +50, giver -50)', db.ensureUser(OWNER).balance === ownerBeforeB + 50 && db.ensureUser(b).balance === bBefore - 50, `owner=${db.ensureUser(OWNER).balance} giver=${db.ensureUser(b).balance} expected giver=${bBefore - 50}`);
  check('owner got exactly one DM approval embed', dms.length === dmsAftConfirmB + 1 && dms.at(-1).embeds[0].data.title.includes('Someone sent u money'), `dms=${dms.length} title=${dms.at(-1).embeds[0].data.title}`);
  const btns = dms.at(-1).components[0].components.map(x => x.data.custom_id);
  check('DM has keep/decline/mute buttons', btns.length === 3 && btns[0].startsWith('ogive_keep_') && btns[1].startsWith('ogive_decline_') && btns[2].startsWith('ogive_mute_'), JSON.stringify(btns));

  console.log('\n== KEEP: owner clicks keep -> money stays, buttons close ==');
  await give.handleInteraction({ user: { id: OWNER }, customId: btns[0], update: async () => {}, deferUpdate: async () => {} });
  await tick();
  check('balances unchanged by keep', db.ensureUser(OWNER).balance === ownerBeforeB + 50 && db.ensureUser(b).balance === bBefore - 50, `owner=${db.ensureUser(OWNER).balance}`);
  check('DM buttons closed after keep', dmMsgs.at(-1).edits.length >= 1 && dmMsgs.at(-1).edits.at(-1).components && dmMsgs.at(-1).edits.at(-1).components.length === 0, JSON.stringify(dmMsgs.at(-1).edits.at(-1).embeds && dmMsgs.at(-1).edits.at(-1).embeds[0].data.title));

  console.log('\n== DECLINE: owner clicks decline -> refunds giver + edits original ==');
  const c = uid();
  db.acceptTerms(c);
  db.addBalance(c, 1000);
  const ownerBeforeC = db.ensureUser(OWNER).balance;
  const cBefore = db.ensureUser(c).balance;
  const dmsBeforeDecline = dms.length;
  msg = await makeMessage(`v give <@${OWNER}> 30`, c);
  await handler.handleMessage(msg);
  await confirmGive(msg, c);
  check('decline give triggers a second owner DM', dms.length === dmsBeforeDecline + 1, `dms=${dms.length}`);
  const btns2 = dms.at(-1).components[0].components.map(x => x.data.custom_id);
  await give.handleInteraction({ user: { id: OWNER }, customId: btns2[1], update: async () => {}, deferUpdate: async () => {} });
  await tick();
  check('decline refunds giver (net: owner back to before, giver back to before)', db.ensureUser(OWNER).balance === ownerBeforeC && db.ensureUser(c).balance === cBefore, `owner=${db.ensureUser(OWNER).balance} giver=${db.ensureUser(c).balance}`);
  check('decline edited original confirm message', msg.confirmMsg.edits.length >= 1 && msg.confirmMsg.edits.at(-1).embeds[0].data.title.includes('Declined'), JSON.stringify(msg.confirmMsg.edits.at(-1).embeds[0].data.title));

  console.log('\n== DECLINE FAILS SAFELY WHEN OWNER SPENDS BEFORE DECIDING ==');
  const d = uid();
  db.acceptTerms(d);
  db.addBalance(d, 5000);
  const dBefore = db.ensureUser(d).balance;
  msg = await makeMessage(`v give <@${OWNER}> 5000`, d);
  await handler.handleMessage(msg);
  await confirmGive(msg, d);
  const giverAfterGiveD = db.ensureUser(d).balance;
  setOwnerBalance(100); // owner spends the gift before clicking decline
  const dtns3 = dms.at(-1).components[0].components.map(x => x.data.custom_id);
  let failUpdate = null;
  await give.handleInteraction({ user: { id: OWNER }, customId: dtns3[1], update: async (p) => { failUpdate = p; }, deferUpdate: async () => {} });
  await tick();
  check('decline blocked (no funds), balances unchanged', db.ensureUser(OWNER).balance === 100 && db.ensureUser(d).balance === giverAfterGiveD, `owner=${db.ensureUser(OWNER).balance} giver=${db.ensureUser(d).balance}`);
  check('decline-fail embed tells owner why', !!failUpdate && failUpdate.embeds[0].data.fields[0].value.includes('cant decline'), JSON.stringify(failUpdate && failUpdate.embeds && failUpdate.embeds[0].data.fields && failUpdate.embeds[0].data.fields[0].value));

  console.log('\n== MUTE: owner clicks mute -> giver muted 30min, give blocked ==');
  const e = uid();
  db.acceptTerms(e);
  db.addBalance(e, 1000);
  msg = await makeMessage(`v give <@${OWNER}> 25`, e);
  await handler.handleMessage(msg);
  await confirmGive(msg, e);
  const btns4 = dms.at(-1).components[0].components.map(x => x.data.custom_id);
  await give.handleInteraction({ user: { id: OWNER }, customId: btns4[2], update: async () => {}, deferUpdate: async () => {} });
  await tick();
  check('giver is owner-give-muted for ~30 min', db.isOwnerGiveMuted(e) && db.getOwnerGiveMutedUntil(e) > Math.floor(Date.now() / 1000) + 29 * 60, `until_s=${db.getOwnerGiveMutedUntil(e)}`);
  msg = await makeMessage(`v give <@${OWNER}> 10`, e);
  await handler.handleMessage(msg);
  check('muted giver -> blocked with "u cant give this user money"', msg._sends.some(s => s.embeds && s.embeds[0] && s.embeds[0].data && s.embeds[0].data.fields && s.embeds[0].data.fields[0] && s.embeds[0].data.fields[0].value.includes('u cant give this user money')) && msg.confirmMsg !== null && msg.confirmMsg._lastCollector === undefined, JSON.stringify(msg._sends.map(s => s.embeds && s.embeds[0] && s.embeds[0].data && s.embeds[0].data.fields && s.embeds[0].data.fields[0] && s.embeds[0].data.fields[0].value)));
  check('block happens BEFORE any confirm dialog (no collector/buttons)', msg.confirmMsg !== null && msg.confirmMsg._lastCollector === undefined, `sends=${msg._sends.length} collector=${!!(msg.confirmMsg && msg.confirmMsg._lastCollector)}`);
  msg = await makeMessage('v give @otherUser 10', e);
  await handler.handleMessage(msg);
  check('muted giver can STILL give to non-owner users', msg.confirmMsg !== null, `confirm=${!!msg.confirmMsg}`);

  console.log('\n== OWNER-ONLY BUTTONS ==');
  const f = uid();
  db.acceptTerms(f);
  db.addBalance(f, 1000);
  msg = await makeMessage(`v give <@${OWNER}> 15`, f);
  await handler.handleMessage(msg);
  await confirmGive(msg, f);
  const beforeMuteCount = db.getOwnerGiveMutedUntil(f);
  const btns5 = dms.at(-1).components[0].components.map(x => x.data.custom_id);
  let nonOwnerUpdate = null;
  await give.handleInteraction({ user: { id: f }, customId: btns5[2], update: async () => {}, deferUpdate: async () => { nonOwnerUpdate = 'deferred'; } });
  await tick();
  check('non-owner clicking owner buttons is ignored (defer)', nonOwnerUpdate === 'deferred' && db.getOwnerGiveMutedUntil(f) === beforeMuteCount, `defer=${nonOwnerUpdate} muteUntil=${db.getOwnerGiveMutedUntil(f)}`);

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const x of failed) console.log('  - ' + x.name + (x.detail ? ' :: ' + x.detail : ''));
    process.exit(1);
  }
  console.log('ALL OWNER-GIVE TESTS PASSED');
  process.exit(0);
})();