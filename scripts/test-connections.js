// Cross-system connection test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/connections_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/connections_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/connections_test', { recursive: true });

const db = require('../db');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}
function setupEvent(key) {
  db.exec(`DELETE FROM community_events`);
  db.exec(`INSERT OR REPLACE INTO lb_state (key, value) VALUES ('last_community_event', 0)`);
  return db.startCommunityEvent(key);
}
const DAY = Math.floor(Date.now() / 1000 / 86400);
function forceQuest(userId, key, target, reward, seal = 0) {
  db.exec(`INSERT OR REPLACE INTO quests (user_id, day, quest_key, progress, target, reward, claimed, seal_reward)
           VALUES ('${userId}', ${DAY}, '${key}', 0, ${target}, ${reward}, 0, ${seal})`);
}

(async () => {
  await db.init();
  for (const id of ['cn_buy', 'cn_hero', 'cn_merchant']) db.addBalance(id, 0);

  // --- merchant → pet purchase → dex progress (the old disconnected path) ---
  db.setBalance('cn_buy', 100000000);
  forceQuest('cn_buy', 'dex', 5, 1000);
  setupEvent('dex_challenge');
  const dexBefore = db.dexProgress('cn_buy').owned;
  const gemsBefore = db.getGems('cn_buy');

  // Buy a few times so a random pet purchase is guaranteed to include a new species.
  db.refreshMerchant();
  const buy = db.buyMerchantItem('cn_buy', 0);
  check('merchant pet purchase succeeds', buy.ok === true);
  check('merchant pet adds dex progress', db.dexProgress('cn_buy').owned === dexBefore + 1);
  check('merchant pet pays the dex-challenge bonus', db.getGems('cn_buy') === gemsBefore + 2);
  check('merchant pet feeds the dex quest', db.getQuest('cn_buy').progress >= 1);
  check('merchant stock pets do not create player progress for __merchant__',
    (db.exec(`SELECT COUNT(*) AS n FROM quests WHERE user_id = '__merchant__'`)[0].values[0][0]) === 0);
  db.endCommunityEvent('dex_challenge');

  // --- community event completion → per-user event_wins → achievement → title ---
  setupEvent('great_hunt');
  const goal = db.getCommunityProgress('g1', 'great_hunt', 10).goal;
  db.addCommunityProgress('g1', 'great_hunt', goal, 'cn_hero', 10);
  check('coop completion increments event_wins', (db.ensureUser('cn_hero').event_wins || 0) === 1);
  const ach = db.checkAchievements('cn_hero');
  check('coop completion unlocks the Event Hero achievement', ach.some(a => a.key === 'event_hero'));
  db.endCommunityEvent('great_hunt');

  // 5 wins unlocks the event champion title
  db.exec(`UPDATE users SET event_wins = 5 WHERE user_id = 'cn_hero'`);
  const titles = db.checkTitles('cn_hero');
  check('5 event wins unlock the event champion title', titles.includes('event_champion'));

  // --- full loop sanity: hunt-style discovery → dex → achievement ---
  // A brand-new species discovery should move dex progress and be visible to achievements.
  const ownedBefore = db.dexProgress('cn_merchant').owned;
  db.addAnimal('cn_merchant', 0);
  check('discovery advances dex progress', db.dexProgress('cn_merchant').owned === ownedBefore + 1);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
