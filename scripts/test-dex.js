// 92-species dex progression test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/dex_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/dex_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/dex_test', { recursive: true });

const db = require('../db');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}

const ALL = Object.values(db.SPECIES).flat();
function giveSpecies(userId, species, shiny = 0) {
  db.exec(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense, shiny) VALUES ('${userId}', '${species.replace(/'/g, "''")}', 'common', 100, 100, 10, 5, ${shiny})`);
}

(async () => {
  await db.init();
  // checkAchievements/checkTitles read the users row; create the fixture users.
  for (const id of ['dex_fresh', 'dex_partial', 'dex_common', 'dex_milestones']) db.addBalance(id, 0);

  // --- catalog source of truth ---
  check('catalog is 92 species', db.dexCatalog().all.length === 92);
  check('SPECIES total is 92', ALL.length === 92);
  const cat = db.dexCatalog();
  check('catalog has no event species by default', cat.all.length === ALL.length);
  check('catalog keeps every rarity', db.RARITY_ORDER.every(r => cat.byRarity[r].length === db.SPECIES[r].length));

  // --- fresh user ---
  const fresh = db.dexProgress('dex_fresh');
  check('fresh user owns 0', fresh.owned === 0);
  check('fresh user missing all 92', fresh.missing === 92);
  check('fresh user 0%', fresh.percent === 0);
  check('fresh shiny species 0', fresh.shinySpecies === 0);
  check('fresh per-rarity done=false', db.RARITY_ORDER.every(r => fresh.byRarity[r].done === false));

  // --- partial collection + dedupe ---
  const U = 'dex_partial';
  giveSpecies(U, 'Rabbit');
  giveSpecies(U, 'Rabbit'); // duplicate species must not inflate
  giveSpecies(U, 'Sparrow');
  giveSpecies(U, 'Frog');
  const p1 = db.dexProgress(U);
  check('3 distinct species counted once', p1.owned === 3);
  check('missing drops to 89', p1.missing === 89);

  // --- shiny species dedupe ---
  giveSpecies(U, 'Rabbit', 1);
  giveSpecies(U, 'Sparrow', 1);
  const p2 = db.dexProgress(U);
  check('shiny species counts distinct', p2.shinySpecies === 2);
  giveSpecies(U, 'Sparrow', 1); // duplicate shiny species
  check('duplicate shiny species still 2', db.dexProgress(U).shinySpecies === 2);

  // --- all commons => rarity complete ---
  const C = 'dex_common';
  for (const s of db.SPECIES.common) giveSpecies(C, s);
  const pc = db.dexProgress(C);
  check('owning all commons completes common', pc.byRarity.common.done === true);
  check('common owned == 25', pc.byRarity.common.owned === 25);
  check('rare not complete', pc.byRarity.rare.done === false);

  // --- species-count milestones ---
  const M = 'dex_milestones';
  for (let i = 0; i < 10; i++) giveSpecies(M, ALL[i]);
  let pm = db.dexProgress(M);
  let hit = db.dexMilestonesHit(pm);
  check('10 species hits dex_10', hit.includes('dex_10'));
  check('10 species does not hit dex_25', !hit.includes('dex_25'));
  check('nextDexMilestone after 10 is 25', db.nextDexMilestone(pm).need === 25);

  for (let i = 10; i < 92; i++) giveSpecies(M, ALL[i]);
  pm = db.dexProgress(M);
  check('owning all 92 => owned 92', pm.owned === 92);
  check('owning all 92 => 100%', pm.percent === 100);
  check('owning all 92 => complete', pm.complete === true);
  check('nextDexMilestone is null at full dex', db.nextDexMilestone(pm) === null);
  hit = db.dexMilestonesHit(pm);
  check('full dex hits dex_50', hit.includes('dex_50'));
  check('full dex hits dex_75', hit.includes('dex_75'));
  check('full dex hits dex_90', hit.includes('dex_90'));
  check('full dex hits dex_full', hit.includes('dex_full'));
  check('full dex hits all rarity milestones', db.RARITY_ORDER.every(r => hit.includes(`dex_all_${r}`)));

  // --- global achievements integrate ---
  const achieved = db.checkAchievements(M).map(a => a.key || a);
  check('dex_50 achievement unlocks', achieved.includes('dex_50'));
  check('dex_75 achievement unlocks', achieved.includes('dex_75'));
  check('dex_full achievement unlocks', achieved.includes('dex_full'));
  check('rarity-complete achievement unlocks', achieved.includes('dex_complete_common'));

  // --- titles integrate ---
  const titles = db.checkTitles(M);
  check('living dex title unlocks', titles.includes('living_dex'));
  check('dex master title unlocks', titles.includes('dex_master'));

  // --- event-exclusive species must not block normal completion ---
  db.SPECIES.common.push('EventOnly');
  db.EVENT_SPECIES.push('EventOnly');
  const eventProg = db.dexProgress(M);
  check('event species excluded from total', eventProg.total === 92);
  check('event species excluded from owned', eventProg.owned === 92);
  check('owning normal catalog stays complete with an event species', eventProg.complete === true);
  db.SPECIES.common.pop();
  db.EVENT_SPECIES.pop();
  check('event exclusion reverts cleanly', db.dexCatalog().all.length === 92);

  // --- v dex command smoke (overview / shiny / missing / rarity / invalid) ---
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'discord.js') {
      return { EmbedBuilder: class { setColor() { return this; } setTitle() { return this; } addFields() { return this; } setDescription(t) { this.description = t; return this; } } };
    }
    return origLoad.apply(this, arguments);
  };
  const dexCmd = require('../commands/dex');
  let sent = null;
  const fakeMsg = { author: { id: M, username: 'Tester' }, channel: { send: async (p) => { sent = p; return {}; } } };
  await dexCmd.execute(fakeMsg, []);
  check('v dex overview sends an embed', !!sent && Array.isArray(sent.embeds) && sent.embeds.length === 1);
  sent = null; await dexCmd.execute(fakeMsg, ['shiny']);
  check('v dex shiny works', !!sent);
  sent = null; await dexCmd.execute(fakeMsg, ['missing']);
  check('v dex missing works', !!sent);
  sent = null; await dexCmd.execute(fakeMsg, ['rare']);
  check('v dex rarity works', !!sent);
  sent = null; await dexCmd.execute(fakeMsg, ['bogus']);
  check('v dex rejects invalid subcommand', !!sent);
  Module._load = origLoad;

  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
