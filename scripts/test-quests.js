// Expanded quests/bounties test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/quests_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/quests_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/quests_test', { recursive: true });

const db = require('../db');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}

const DAY = Math.floor(Date.now() / 1000 / 86400);
const OBJECTIVE_KEYS = ['hunt', 'sacrifice', 'work', 'give', 'battle', 'hatch', 'gem', 'social', 'dex', 'petlevel', 'bond', 'merchant', 'inbox', 'streak', 'xp', 'event', 'contract'];

// Force the daily quest to a known objective (deterministic instead of random).
function forceQuest(userId, key, target, reward, seal = 0) {
  db.exec(`INSERT OR REPLACE INTO quests (user_id, day, quest_key, progress, target, reward, claimed, seal_reward)
           VALUES ('${userId}', ${DAY}, '${key}', 0, ${target}, ${reward}, 0, ${seal})`);
}
function forceBounty(userId, key, target, reward, seal = 0) {
  const WEEK = Math.floor(DAY / 7);
  db.exec(`INSERT OR REPLACE INTO bounties (user_id, week, quest_key, progress, target, reward, claimed, seal_reward)
           VALUES ('${userId}', ${WEEK}, '${key}', 0, ${target}, ${reward}, 0, ${seal})`);
}
function rerollQuest(userId) {
  db.exec(`DELETE FROM quests WHERE user_id = '${userId}'`);
  return db.getQuest(userId);
}

(async () => {
  await db.init();
  const ids = ['q_fresh', 'q_prog', 'q_claim', 'q_seal', 'q_dbl', 'q_dex', 'q_hatch', 'q_xp', 'q_social', 'q_streak', 'q_inbox', 'q_event', 'q_petlvl', 'q_bond', 'q_bounty'];
  for (const id of ids) db.addBalance(id, 0);

  // --- objective catalogue ---
  check('QUEST_OBJECTIVES labels every supported key', OBJECTIVE_KEYS.every(k => typeof db.QUEST_OBJECTIVES[k] === 'string' && db.QUEST_OBJECTIVES[k].length > 0));
  check('old unreachable "win" objective is gone', !db.QUEST_OBJECTIVES.win);

  // --- eligibility: a fresh user with no pets + no event must never roll pet/event tasks ---
  const GATED = new Set(['battle', 'petlevel', 'bond', 'event']);
  let sawGated = false, sawUnknown = false, sawBadTarget = false, sawBadSeal = false;
  for (let i = 0; i < 400; i++) {
    const q = rerollQuest('q_fresh');
    if (GATED.has(q.key)) sawGated = true;
    if (!db.QUEST_OBJECTIVES[q.key]) sawUnknown = true;
    if (!(q.target >= 1)) sawBadTarget = true;
    if (![0, 1].includes(q.sealReward)) sawBadSeal = true;
  }
  check('fresh user never rolls a pets-gated quest', !sawGated);
  check('every rolled key has a label', !sawUnknown);
  check('every rolled target is >= 1', !sawBadTarget);
  check('rolled seal reward is 0 or 1', !sawBadSeal);

  // --- eligibility: pets unlock the pet objectives ---
  db.addAnimal('q_fresh', 0);
  const sawPets = new Set();
  for (let i = 0; i < 1500; i++) {
    const q = rerollQuest('q_fresh');
    if (['battle', 'petlevel', 'bond'].includes(q.key)) sawPets.add(q.key);
  }
  check('pet owner can roll battle quests', sawPets.has('battle'));
  check('pet owner can roll petlevel quests', sawPets.has('petlevel'));
  check('pet owner can roll bond quests', sawPets.has('bond'));

  // --- progress only counts matching objectives, capped at target ---
  forceQuest('q_prog', 'hunt', 3, 1000);
  db.trackProgress('q_prog', 'work', 10);          // wrong key
  check('non-matching progress ignored', db.getQuest('q_prog').progress === 0);
  db.trackProgress('q_prog', 'hunt', 5);           // over target
  check('matching progress capped at target', db.getQuest('q_prog').progress === 3);

  // --- claim grants reward once ---
  forceQuest('q_claim', 'hunt', 2, 20000);
  db.trackProgress('q_claim', 'hunt', 2);
  const before = db.ensureUser('q_claim').balance;
  const cq = db.claimQuest('q_claim');
  check('claimQuest returns the quest', !!cq && cq.reward === 20000);
  check('claimQuest pays the reward', db.ensureUser('q_claim').balance === before + 20000);
  check('claimQuest marks claimed', db.getQuest('q_claim').claimed === true);
  check('second claim is rejected', db.claimQuest('q_claim') === null);

  // --- rare objectives also pay a seal ---
  forceQuest('q_seal', 'hunt', 1, 1000, 1);
  db.trackProgress('q_seal', 'hunt', 1);
  const sealsBefore = db.getSeals('q_seal');
  db.claimQuest('q_seal');
  check('seal reward credited on claim', db.getSeals('q_seal') === sealsBefore + 1);

  // --- double_quest perk doubles the coins ---
  db.addPerk('q_dbl', 'double_quest', 0);
  forceQuest('q_dbl', 'hunt', 1, 1000, 0);
  db.trackProgress('q_dbl', 'hunt', 1);
  const dblBefore = db.ensureUser('q_dbl').balance;
  db.claimQuest('q_dbl');
  check('double_quest perk doubles reward', db.ensureUser('q_dbl').balance === dblBefore + 2000);

  // --- real-system hooks feed quest progress ---
  forceQuest('q_dex', 'dex', 1, 100);
  db.addAnimal('q_dex', 0);
  check('addAnimal tracks a new species (dex)', db.getQuest('q_dex').progress >= 1);

  forceQuest('q_hatch', 'hatch', 1, 100);
  db.addEgg('q_hatch', 1);
  db.hatchEgg('q_hatch');
  check('hatchEgg tracks hatching', db.getQuest('q_hatch').progress >= 1);

  forceQuest('q_xp', 'xp', 100000, 100);
  db.addXpRaw('q_xp', 50);
  check('addXpRaw tracks XP', db.getQuest('q_xp').progress >= 50);
  forceQuest('q_xp', 'xp', 100000, 100);
  db.grantXp('q_xp', 25);
  check('grantXp tracks XP', db.getQuest('q_xp').progress >= 25);

  forceQuest('q_social', 'social', 1, 100);
  db.bumpSocial('q_social');
  check('bumpSocial tracks social use', db.getQuest('q_social').progress >= 1);

  forceQuest('q_streak', 'streak', 1, 100);
  db.claimStreak('q_streak');
  check('claimStreak tracks the streak', db.getQuest('q_streak').progress >= 1);

  forceQuest('q_inbox', 'inbox', 1, 100);
  const delId = db.createDelivery('q_inbox', { amount: 5, source: 'system', label: 'test' });
  db.safeClaim(delId, 'q_inbox');
  check('claiming a delivery tracks inbox', db.getQuest('q_inbox').progress >= 1);

  forceQuest('q_petlvl', 'petlevel', 1, 100);
  const pet = db.addAnimal('q_petlvl', 0);
  db.addExp(pet.id, 100000);
  check('levelling a pet tracks petlevel', db.getQuest('q_petlvl').progress >= 1);

  forceQuest('q_bond', 'bond', 1, 100);
  const pet2 = db.addAnimal('q_bond', 0);
  db.addExp(pet2.id, 100000);
  check('raising bond tier tracks bond', db.getQuest('q_bond').progress >= 1);

  // event objective only counts while a community event is live
  forceQuest('q_event', 'event', 1, 100);
  db.bumpCounter('q_event', 'button_pressed');
  check('event progress does not count with no live event', db.getQuest('q_event').progress === 0);
  const ev = db.startCommunityEvent();
  if (ev && ev.key) {
    db.bumpCounter('q_event', 'button_pressed');
    check('event progress counts during a live event', db.getQuest('q_event').progress >= 1);
    db.endCommunityEvent(ev.key);
  } else {
    check('started a community event for the event test', false);
  }

  // --- bounties mirror quests ---
  forceBounty('q_bounty', 'hunt', 2, 500000, 1);
  db.trackProgress('q_bounty', 'hunt', 2);
  const bBefore = db.ensureUser('q_bounty').balance;
  const bSeals = db.getSeals('q_bounty');
  const cb = db.claimBounty('q_bounty');
  check('claimBounty pays the reward', !!cb && db.ensureUser('q_bounty').balance === bBefore + 500000);
  check('claimBounty pays the seal', db.getSeals('q_bounty') === bSeals + 1);
  check('second bounty claim rejected', db.claimBounty('q_bounty') === null);

  // --- command smoke test (overview + not-done claim) ---
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'discord.js') {
      return { EmbedBuilder: class { setColor() { return this; } setTitle() { return this; } addFields() { return this; } setDescription(t) { this.description = t; return this; } } };
    }
    return origLoad.apply(this, arguments);
  };
  const questCmd = require('../commands/quest');
  const bountyCmd = require('../commands/bounty');
  const fakeMsg = { author: { id: 'q_fresh', username: 'Tester' }, channel: { send: async (p) => { fakeMsg.sent = p; return {}; } } };
  forceQuest('q_fresh', 'hunt', 10, 20000);
  fakeMsg.sent = null; await questCmd.execute(fakeMsg, []);
  check('v quest overview sends an embed', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds) && fakeMsg.sent.embeds.length === 1);
  fakeMsg.sent = null; await questCmd.execute(fakeMsg, ['claim']);
  check('v quest claim handles not-done', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds));
  forceBounty('q_fresh', 'hunt', 60, 200000);
  fakeMsg.sent = null; await bountyCmd.execute(fakeMsg, []);
  check('v bounty overview sends an embed', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds) && fakeMsg.sent.embeds.length === 1);
  Module._load = origLoad;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
