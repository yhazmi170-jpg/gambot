// sacrifice all atomicity + correctness regression (Nini incident 2026-09-27):
// pets must NEVER be removed without essence credited. Unpriced rarities (SECRET)
// and non-lowercase rarities (COMMON import artifact) must never poison the total.
process.env.DB_PATH = '/tmp/sac_atomic_test';
const fs = require('fs');
fs.rmSync('/tmp/sac_atomic_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/sac_atomic_test', { recursive: true });

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
const USER = 'sac_u1';

async function seedAnimal(rarity, opts = {}) {
  const hp = opts.hp || 100, at = opts.atk || 10, df = opts.def || 10;
  const lvl = opts.level || 1;
  db.exec(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense, level, exp, shiny, trait) VALUES ('${USER}','${opts.species || 'Test'}','${rarity}',${hp},${hp},${at},${df},${lvl},0,${opts.shiny ? 1 : 0},'Calm')`);
  return db.exec('SELECT MAX(id) FROM animals')[0].values[0][0];
}
const allIds = () => {
  const res = db.exec(`SELECT id FROM animals WHERE user_id='${USER}'`);
  if (!res.length || !res[0].values.length) return [];
  return res[0].values.map(v => v[0]).sort((a, b) => a - b);
};
const countIds = () => allIds().length;
function makeMsg(mentionId) {
  const sent = [];
  return {
    author: { id: USER, bot: false, username: 'tester' },
    guild: { id: '111' },
    channel: { id: '222', type: 0, send: async (payload) => { sent.push(payload); return {}; } },
    mentions: { users: { first: () => (mentionId ? { id: mentionId } : null) } },
    content: '',
    _sent: sent,
  };
}

async function main() {
  await db.init();
  db.addBalance(USER, 500000); // auto-creates user
  handler.loadCommands();
  const cmd = handler.getCommand('sacrifice');
  check('sacrifice command registered', !!cmd && cmd.name === 'sacrifice');

  // --- 1) success: many pets, mixed rarity + shiny + leveled ---
  {
    const c1 = await seedAnimal('common');
    const c2 = await seedAnimal('uncommon', { shiny: true }); // 3*2 = 6
    const c3 = await seedAnimal('rare');
    const c4 = await seedAnimal('epic');
    const c5 = await seedAnimal('legendary', { level: 42 }); // level irrelevant to price
    const c6 = await seedAnimal('mythic');
    const es0 = db.getEssence(USER);
    const r = db.sacrificeAnimals(USER, 'all');
    const expected = 1 + 6 + 8 + 25 + 100 + 500;
    check('all: essence sum = 640', r.essence === expected, `${r.essence} vs ${expected}`);
    check('all: sacrificed 6', r.sacrificed === 6, r.sacrificed);
    check('all: counted shiny', r.shinyCount === 1, r.shinyCount);
    check('all: essence credited', db.getEssence(USER) === es0 + expected, `${db.getEssence(USER)} vs ${es0 + expected}`);
    check('all: 0 pets remain', countIds() === 0, countIds());
    check('all: no unpriced skips', r.unknown === 0 && r.unknownRarities.length === 0);
  }

  // --- 2) one pet ---
  {
    await seedAnimal('common');
    const r = db.sacrificeAnimals(USER, 'all');
    check('one common -> 1 essence', r.essence === 1 && r.sacrificed === 1, JSON.stringify(r));
    check('one: gone', countIds() === 0);
  }

  // --- 3) rare/shiny double ---
  {
    await seedAnimal('rare');
    await seedAnimal('epic', { shiny: true }); // 50
    const r = db.sacrificeAnimals(USER, 'all');
    check('shiny epic => 50 + rare 8 = 58', r.essence === 58, r.essence);
  }

  // --- 4) zero pets ---
  {
    const es0 = db.getEssence(USER);
    const r = db.sacrificeAnimals(USER, 'all');
    check('zero pets: no crash, 0 result', r.sacrificed === 0 && r.essence === 0, JSON.stringify(r));
    check('zero pets: essence unchanged', db.getEssence(USER) === es0);
  }

  // --- 5) forced failure BEFORE mutation: all on team -> skipped ---
  {
    const a1 = await seedAnimal('common');
    const a2 = await seedAnimal('epic');
    db.setTeam(USER, 1, a1);
    db.setTeam(USER, 2, a2);
    const es0 = db.getEssence(USER);
    const r = db.sacrificeAnimals(USER, 'all');
    check('team-only: sacrificed 0, skipped 2', r.sacrificed === 0 && r.skipped === 2, JSON.stringify(r));
    check('team-only: both pets remain', allIds().join(',').split(',').length === 2);
    check('team-only: essence unchanged', db.getEssence(USER) === es0);
    // clear team for later tests
    db.setTeam(USER, 1, null);
    db.setTeam(USER, 2, null);
  }

  // --- 6) forced failure DURING mutation: DELETE forced to abort -> full rollback ---
  {
    db.exec(`DELETE FROM animals WHERE user_id='${USER}'`);
    const a1 = await seedAnimal('common');
    const a2 = await seedAnimal('mythic'); // 500
    const es0 = db.getEssence(USER);
    db.exec(`CREATE TRIGGER t_forcedel BEFORE DELETE ON animals BEGIN SELECT RAISE(ABORT, 'forced'); END`);
    let threw = null;
    try { db.sacrificeAnimals(USER, 'all'); } catch (e) { threw = e; }
    check('forced: sacrificeAnimals threw', !!threw, threw && threw.message);
    check('forced: both pets INTACT (rollback)', countIds() === 2, countIds());
    check('forced: essence UNCHANGED', db.getEssence(USER) === es0, `${db.getEssence(USER)} vs ${es0}`);
    db.exec('DROP TRIGGER t_forcedel');
    const r = db.sacrificeAnimals(USER, 'all'); // recovery run after failure
    check('forced: recovery run works after fix', r.sacrificed === 2 && r.essence === 501, JSON.stringify(r));
    check('forced: essence credited after recovery', db.getEssence(USER) === es0 + 501, db.getEssence(USER));
  }

  // --- 7) reward-calculation failure: unpriced SECRET must be LEFT ALONE ---
  {
    const s = await seedAnimal('SECRET');
    const c = await seedAnimal('common');
    const es0 = db.getEssence(USER);
    const r = db.sacrificeAnimals(USER, 'all');
    check('secret: common credited (1), secret skipped', r.essence === 1 && r.unknown === 1, JSON.stringify(r));
    check('secret: unknownRarities reported', (r.unknownRarities || []).join(',') === 'secret', JSON.stringify(r.unknownRarities));
    check('secret: SECRET pet NOT removed', allIds().length === 1 && allIds()[0] === s, allIds().join(','));
    check('secret: common removed', allIds().indexOf(c) === -1);
    check('secret: essence correct', db.getEssence(USER) === es0 + 1);
    check('secret: shinyCount excludes secret', r.shinyCount === 0, r.shinyCount);
    void c;
  }

  // --- 8) uppercase rarity (the actual incident artifact): COMMON == common ---
  {
    db.exec(`DELETE FROM animals WHERE user_id='${USER}'`);
    await seedAnimal('COMMON');          // 1
    await seedAnimal('UNCOMMON', { shiny: true }); // 6
    await seedAnimal('RARE');            // 8
    await seedAnimal('SECRET');          // skip
    const es0 = db.getEssence(USER);
    const r = db.sacrificeAnimals(USER, 'all');
    check('uppercase: priced total 15 (1+6+8), secret skipped', r.essence === 15 && r.unknown === 1, JSON.stringify(r));
    check('uppercase: SECRET remains', countIds() === 1 && allIds().length === 1);
    check('uppercase: essence credited', db.getEssence(USER) === es0 + 15, db.getEssence(USER));
    db.exec(`DELETE FROM animals WHERE user_id='${USER}'`);
  }

  // --- 9) response-send failure must NOT duplicate rewards on retry ---
  {
    await seedAnimal('rare');  // 8
    await seedAnimal('epic');  // 25
    const es0 = db.getEssence(USER);
    const badMsg = makeMsg();
    badMsg.channel.send = async () => { throw new Error('network'); };
    await cmd.execute(badMsg, ['all']); // success-path send is fire-and-forget — rejection terminates the reply, NOT the reward
    check('send-fail: DB committed anyway (pets gone)', countIds() === 0, countIds());
    check('send-fail: essence credited 33', db.getEssence(USER) === es0 + 33, `${db.getEssence(USER)} vs ${es0 + 33}`);
    const retry = makeMsg();
    await cmd.execute(retry, ['all']); // ignore send, must NOT re-credit
    check('send-fail: retry does NOT double-reward', db.getEssence(USER) === es0 + 33, db.getEssence(USER));
  }

  // --- 10) retry/idempotency at db layer ---
  {
    await seedAnimal('common');
    const es0 = db.getEssence(USER);
    const r1 = db.sacrificeAnimals(USER, 'all');
    const r2 = db.sacrificeAnimals(USER, 'all');
    check('idempotent: first 1 essence, second 0', r1.essence === 1 && r1.sacrificed === 1 && r2.essence === 0 && r2.sacrificed === 0, JSON.stringify([r1, r2]));
    check('idempotent: essence credited exactly once', db.getEssence(USER) === es0 + 1, db.getEssence(USER));
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('TEST CRASH', e); process.exit(1); });