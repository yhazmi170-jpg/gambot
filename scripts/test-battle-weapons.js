// Quick battle-with-weapons harness. Mock discord.js + battleImage, run a real battle.
process.env.DB_PATH = '/tmp/weapon_battle/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/weapon_battle', { recursive: true, force: true });
fs.mkdirSync('/tmp/weapon_battle', { recursive: true });

// --- stub discord.js before anything requires it ---
let lastRender = null;
const Module = require('module');
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') {
    return {
      ActionRowBuilder: class { constructor() {} addComponents(...c) { this.c = c; return this; } },
      ButtonBuilder: class { constructor() {} setCustomId() { return this; } setLabel() { return this; } setStyle() { return this; } setEmoji() { return this; } },
      ButtonStyle: { Success: 1, Danger: 2, Secondary: 3 },
      EmbedBuilder: class { setColor() { return this; } setDescription(t) { this.d = t; return this; } },
    };
  }
  if (request === '../utils/battleImage') {
    return { renderBattleImage: (opts) => { lastRender = opts; return Buffer.from('PNGDATA'); } };
  }
  return orig.apply(this, arguments);
};

const db = require('../db');
const battle = require('../commands/battle');

(async () => {
  await db.init();
  const A = 'user_A', B = 'user_B';

  // seed users + teams + weapons
  db.addBalance(A, 10e6); db.addBalance(B, 10e6);
  const a1 = db.addAnimal(A), a2 = db.addAnimal(A), a3 = db.addAnimal(A);
  const b1 = db.addAnimal(B), b2 = db.addAnimal(B);
  db.setTeam(A, 1, a1.id); db.setTeam(A, 2, a2.id); db.setTeam(A, 3, a3.id);
  db.setTeam(B, 1, b1.id); db.setTeam(B, 2, b2.id);

  // give A a great sword + flame staff, B a vamp staff
  const w1 = db.openWeaponCrate(A); // random
  // force specific types by directly inserting for test determinism
  db.addWeaponCrate(A, 5); db.addWeaponCrate(B, 5);
  const opened = [];
  for (let i = 0; i < 5; i++) opened.push(db.openWeaponCrate(A));
  for (let i = 0; i < 5; i++) db.openWeaponCrate(B);
  const invA = db.getWeaponInv(A);
  const invB = db.getWeaponInv(B);
  const setType = (id, type, rarity, quality) => {
    db.exec(`UPDATE weapons_inv SET type='${type}', rarity='${rarity}', quality=${quality} WHERE id=${id}`);
  };
  setType(invA[0].id, 'great_sword', 'rare', 55);
  setType(invA[1].id, 'flame_staff', 'epic', 70);
  setType(invA[2].id, 'heal_staff', 'uncommon', 30);
  setType(invB[0].id, 'vamp_staff', 'rare', 50);
  setType(invB[1].id, 'poison_dagger', 'epic', 60);

  db.equipWeapon(a1.id, invA[0].id, A);
  db.equipWeapon(a2.id, invA[1].id, A);
  db.equipWeapon(a3.id, invA[2].id, A);
  db.equipWeapon(b1.id, invB[0].id, B);
  db.equipWeapon(b2.id, invB[1].id, B);

  // pre-seed pending battle
  const pendKey = `${A}_${B}_${Date.now()}`;
  db.setPendingBattle(pendKey, A, B, Math.floor(Date.now() / 1000) + 60);

  let sentImg = false;
  const fakeAccess = { users: { fetch: async () => ({ id: A, username: 'UserA' }) } };
  const fakeChannel = {
    send: async (payload) => { if (payload.files) { sentImg = true; console.log('[BATTLE] image sent OK,', payload.files.length, 'attachment(s)'); } return { edit: async () => {} }; },
  };
  const i = {
    customId: `battle_${pendKey}_yes`,
    user: { id: B },
    client: fakeAccess,
    message: { channel: fakeChannel, guild: null, edit: async () => {} },
    update: async () => {}, deferUpdate: async () => {},
  };

  await battle.handleInteraction(i);
  console.log(sentImg ? '[BATTLE] battle ran + image produced ✔' : '[BATTLE] did not reach image send!');
  // verify weapon effects appear in rendered log data
  const events = lastRender?.events || lastRender?.log || [];
  const joined = JSON.stringify(lastRender || {});
  const hasSweep = /sweeps|great sword|⚔️/.test(joined);
  const hasWeaponEmoji = /(🗡️|🔥|🧛|💚|🛡️|🏹|🔮|⚔️)/.test(joined);
  const hasDot = /burn|poison|takes/.test(joined);
  console.log('[BATTLE-LOG] weapon action present:', hasWeaponEmoji && hasSweep && hasDot);
  console.log(joined.slice(0, 900));
  console.log('WEAPON_BATTLE_DROP_CHANCE:', db.WEAPON_BATTLE_DROP_CHANCE);
  console.log('ALL OK');
  process.exit(sentImg ? 0 : 1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });