// Test bot battle support in commands/battle.js
process.env.DB_PATH = '/tmp/test_battle_bot/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/test_battle_bot', { recursive: true, force: true });
fs.mkdirSync('/tmp/test_battle_bot', { recursive: true });

let lastRender = null;
const Module = require('module');
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') {
    return {
      ActionRowBuilder: class { constructor() {} addComponents(...c) { this.c = c; return this; } },
      ButtonBuilder: class { constructor() {} setCustomId() { return this; } setLabel() { return this; } setStyle() { return this; } setEmoji() { return this; } },
      ButtonStyle: { Success: 1, Danger: 2, Secondary: 3 },
      EmbedBuilder: class {
        setColor() { return this; }
        setTitle(t) { this.title = t; return this; }
        setDescription(t) { this.d = t; return this; }
        addFields(...f) { this.fields = (this.fields || []).concat(f); return this; }
      },
    };
  }
  if (request === '../utils/battleImage') {
    return {
      renderBattleImage: (opts) => {
        lastRender = opts;
        return Buffer.from('FAKE_PNG_BYTES');
      },
    };
  }
  return orig.apply(this, arguments);
};

const assert = require('assert');
const db = require('../db');
const battle = require('../commands/battle');

(async () => {
  await db.init();
  const U1 = 'user_1';
  const U2 = 'user_2';
  db.addBalance(U1, 1000000);
  db.addBalance(U2, 1000000);

  // 1. Test empty team error
  let sentError = null;
  const mockChannel = {
    send: async (payload) => {
      if (payload.embeds) sentError = payload.embeds[0];
      return { edit: async () => {} };
    },
  };
  await battle.execute({ author: { id: U1, username: 'Player1' }, mentions: { users: new Map() }, channel: mockChannel }, []);
  assert(sentError, 'Should send error for empty team');
  console.log('Test 1: Empty team check PASS');

  // Seed user 1 pets & team
  const p1 = db.addAnimal(U1);
  const p2 = db.addAnimal(U1);
  db.setTeam(U1, 1, p1.id);
  db.setTeam(U1, 2, p2.id);

  // 2. Test battle with no args -> runs bot battle
  let sentImage = false;
  mockChannel.send = async (payload) => {
    if (payload.files) {
      sentImage = true;
      return { edit: async () => {} };
    }
    if (payload.embeds) sentError = payload.embeds[0];
  };

  await battle.execute({ author: { id: U1, username: 'Player1' }, mentions: { users: new Map() }, channel: mockChannel }, []);
  assert(sentImage, 'Should produce battle image for bot battle with no args');
  assert.strictEqual(lastRender.playerName, 'Player1');
  assert.strictEqual(lastRender.enemyName, 'Bot Trainer');
  assert.strictEqual(lastRender.myPets.length, 2, 'My pets should match team count');
  assert.strictEqual(lastRender.theirPets.length, 2, 'Bot team should match player team count');
  console.log('Test 2: No-arg bot battle PASS');

  // 3. Test battle with 'bot' arg
  sentImage = false;
  lastRender = null;
  await battle.execute({ author: { id: U1, username: 'Player1' }, mentions: { users: new Map() }, channel: mockChannel }, ['bot']);
  assert(sentImage, 'Should produce battle image for v battle bot');
  assert.strictEqual(lastRender.enemyName, 'Bot Trainer');
  console.log('Test 3: v battle bot PASS');

  // 4. Test battle with bot mention
  sentImage = false;
  lastRender = null;
  const botUser = { id: 'bot_99', username: 'DiscordBot', bot: true };
  const mentionsBot = new Map([[botUser.id, botUser]]);
  mentionsBot.first = () => botUser;
  await battle.execute({ author: { id: U1, username: 'Player1' }, mentions: { users: mentionsBot }, channel: mockChannel }, ['<@bot_99>']);
  assert(sentImage, 'Should produce battle image for v battle @bot');
  assert.strictEqual(lastRender.enemyName, 'DiscordBot');
  console.log('Test 4: v battle @bot PASS');

  // 5. Test battle with human user (PvP challenge flow)
  const humanUser = { id: U2, username: 'Player2', bot: false };
  const mentionsHuman = new Map([[humanUser.id, humanUser]]);
  mentionsHuman.first = () => humanUser;
  let sentEmbed = null;
  mockChannel.send = async (payload) => {
    if (payload.embeds) sentEmbed = payload.embeds[0];
    return { edit: async () => {} };
  };

  // U2 has no team yet -> error
  await battle.execute({ author: { id: U1, username: 'Player1' }, mentions: { users: mentionsHuman }, channel: mockChannel }, ['<@user_2>']);
  assert(sentEmbed, 'Should send error that Player2 team is empty');
  console.log('Test 5a: Opponent empty team check PASS');

  // Give U2 team
  const p3 = db.addAnimal(U2);
  db.setTeam(U2, 1, p3.id);
  sentEmbed = null;
  let sentButtons = false;
  mockChannel.send = async (payload) => {
    if (payload.components) sentButtons = true;
    if (payload.embeds) sentEmbed = payload.embeds[0];
    return { edit: async () => {} };
  };
  await battle.execute({ author: { id: U1, username: 'Player1' }, mentions: { users: mentionsHuman }, channel: mockChannel }, ['<@user_2>']);
  assert(sentButtons, 'Should send buttons for human challenge');
  console.log('Test 5b: Human challenge with buttons PASS');

  console.log('\nALL BOT BATTLE TESTS PASSED SUCCESSFULLY! (6/6)');
  process.exit(0);
})().catch(e => {
  console.error('FAIL', e);
  process.exit(1);
});
