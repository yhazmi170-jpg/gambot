// Pet bond / affinity progression test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/pet_bond_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/pet_bond_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/pet_bond_test', { recursive: true });

const db = require('../db');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}
const U = 'bond_user';

(async () => {
  await db.init();
  db.addBalance(U, 1e9);
  db.addEssence(U, 1e6);

  // --- schema / migration ---
  const cols = db.exec('PRAGMA table_info(animals)')[0].values.map(v => v[1]);
  check('animals has bond column', cols.includes('bond'));
  // idempotent: running init again must not throw
  let reinitOk = true;
  try { await db.init(); } catch (e) { reinitOk = false; }
  check('init is idempotent (no destructive migration)', reinitOk);

  // --- defaults ---
  const pet = db.addAnimal(U);
  const fresh = db.getAnimal(pet.id);
  check('new pet starts at 0 bond', fresh.bond === 0);
  check('new pet tier is Stranger', db.bondTier(fresh.bond).name === 'Stranger');
  check('getUserAnimals exposes bond', db.getUserAnimals(U)[0].bond === 0);

  // --- tier boundaries ---
  check('tier 0 = Stranger', db.bondTier(0).name === 'Stranger');
  check('tier 49 = Stranger', db.bondTier(49).name === 'Stranger');
  check('tier 50 = Acquaintance', db.bondTier(50).name === 'Acquaintance');
  check('tier 150 = Companion', db.bondTier(150).name === 'Companion');
  check('tier 400 = Loyal', db.bondTier(400).name === 'Loyal');
  check('tier 1000 = Devoted', db.bondTier(1000).name === 'Devoted');
  check('tier 2500 = Soulbound', db.bondTier(2500).name === 'Soulbound');
  check('bondTier exposes next threshold', db.bondTier(60).next.min === 150);

  // --- multiplier ---
  check('mult 1.0 at 0 bond', db.bondMultiplier(0) === 1);
  check('mult 1.02 at 50 bond', Math.abs(db.bondMultiplier(50) - 1.02) < 1e-9);
  check('mult 1.10 at 2500 bond', Math.abs(db.bondMultiplier(2500) - 1.10) < 1e-9);

  // --- addBond + tier achievement ---
  let r = db.addBond(pet.id, 50);
  check('addBond adds exact amount', r.bond === 50);
  check('addBond reaches Acquaintance', r.tier.name === 'Acquaintance');
  let pAch = db.petAchievementsFor(pet.id).map(a => a.key);
  check('bond_50 pet achievement awarded', pAch.includes('bond_50'));
  check('bond_150 not awarded yet', !pAch.includes('bond_150'));

  // --- tier jump awards every crossed tier ---
  r = db.addBond(pet.id, 1000);
  check('big addBond lands in Devoted', r.tier.name === 'Devoted');
  pAch = db.petAchievementsFor(pet.id).map(a => a.key);
  check('jumped tiers award bond_150', pAch.includes('bond_150'));
  check('jumped tiers award bond_400', pAch.includes('bond_400'));
  check('jumped tiers award bond_1000', pAch.includes('bond_1000'));

  // --- shiny doubles bond gain ---
  const shinyPet = db.addAnimal(U);
  db.exec(`UPDATE animals SET shiny = 1 WHERE id = ${shinyPet.id}`);
  r = db.addBond(shinyPet.id, 10);
  check('shiny gains 2x bond', r.bond === 20);

  // --- bestBond ---
  check('bestBond returns max across pets', db.bestBond(U) >= 1050);

  // --- level-up grants bond ---
  const lvlPet = db.addAnimal(U);
  db.addExp(lvlPet.id, db.expForLevel(1) + 1); // level 1 -> 2
  check('level-up grants bond', db.getAnimal(lvlPet.id).bond >= 2);

  // --- feeding grants bond ---
  const feedPet = db.addAnimal(U);
  db.feedAnimal(feedPet.id);
  check('feeding grants bond', db.getAnimal(feedPet.id).bond >= 5);

  // --- renaming grants bond ---
  const namePet = db.addAnimal(U);
  db.renameAnimal(namePet.id, 'Rex');
  check('renaming grants bond', db.getAnimal(namePet.id).bond >= 2);

  // --- evolving grants bond ---
  const evoPet = db.addAnimal(U);
  db.exec(`UPDATE animals SET rarity = 'common', level = 10 WHERE id = ${evoPet.id}`);
  const evo = db.evolveAnimal(evoPet.id, 100000);
  check('evolution succeeds', evo.ok === true);
  check('evolution grants bond', db.getAnimal(evoPet.id).bond >= 15);

  // --- global achievement integration ---
  const achPet = db.addAnimal(U);
  db.addBond(achPet.id, 150);
  const unlocked = db.checkAchievements(U).map(a => a.key || a);
  check('global "bonded" achievement unlocks at 150', unlocked.includes('bonded'));

  // --- title integration ---
  const titlePet = db.addAnimal(U);
  db.addBond(titlePet.id, 400);
  const titles = db.checkTitles(U);
  check('"bonded" title unlocks at 400', titles.includes('bonded'));

  // --- persistence across reopen ---
  const persistPet = db.addAnimal(U);
  db.addBond(persistPet.id, 73);
  await db.init();
  check('bond persists across DB reopen', db.getAnimal(persistPet.id).bond === 73);

  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
