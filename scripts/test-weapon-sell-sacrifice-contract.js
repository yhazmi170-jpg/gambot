const assert = require('assert');
const db = require('../db');

async function run() {
  console.log('--- Testing Weapon Sell, Weapon Sacrifice & Contract Auto-Settlement ---');
  await db.init();

  const USER_A = 'test_user_wep_a';
  const USER_B = 'test_user_wep_b';

  // Reset test data
  db.exec(`DELETE FROM users WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM weapons_inv WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM animals WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM contracts WHERE creator_id IN ('${USER_A}', '${USER_B}') OR target_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM achievements WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM user_titles WHERE user_id IN ('${USER_A}', '${USER_B}')`);

  db.ensureUser(USER_A);
  db.ensureUser(USER_B);
  db.addBalance(USER_A, 500000);
  db.addBalance(USER_B, 500000);

  // 1. Add weapon crates and open them
  db.addWeaponCrate(USER_A, 5);
  const openRes = db.openWeaponCrates(USER_A, 5);
  assert.strictEqual(openRes.ok, true);
  assert.strictEqual(openRes.opened.length, 5);

  const inv = db.getWeaponInv(USER_A);
  assert.strictEqual(inv.length, 5);
  console.log('Opened 5 weapons:', inv.map(w => `${w.id}:${w.rarity}`));

  // Equip one weapon on an animal
  const a1 = db.addAnimal(USER_A, false);
  db.setTeam(USER_A, 1, a1.id);
  const equipRes = db.equipWeapon(a1.id, inv[0].id, USER_A);
  assert.strictEqual(equipRes.ok, true);

  // Test bulk sell with equipped weapon skip
  const balBefore = db.getBalance(USER_A);
  const sellRes = db.sellWeapons(USER_A, 'all');
  assert.strictEqual(sellRes.sold, 4);
  assert.strictEqual(sellRes.skipped, 1);
  assert.strictEqual(db.getBalance(USER_A), balBefore + sellRes.coins);
  console.log(`Bulk sold 4 weapons for ${sellRes.coins} coins, skipped 1 equipped`);

  // Verify only the 1 equipped weapon remains in inv
  const invAfterSell = db.getWeaponInv(USER_A);
  assert.strictEqual(invAfterSell.length, 1);
  assert.strictEqual(invAfterSell[0].id, inv[0].id);

  // Sell single weapon by ID (even if equipped, explicit single sell unequips and sells)
  const singleSellRes = db.sellWeapon(inv[0].id, USER_A);
  assert.strictEqual(singleSellRes.ok, true);
  assert.strictEqual(db.getWeaponInv(USER_A).length, 0);
  console.log(`Single sold equipped weapon #${inv[0].id}`);

  // 2. Test weapon sacrifice
  db.addWeaponCrate(USER_A, 6);
  db.openWeaponCrates(USER_A, 6);
  const inv2 = db.getWeaponInv(USER_A);
  assert.strictEqual(inv2.length, 6);

  // Equip one weapon
  db.equipWeapon(a1.id, inv2[0].id, USER_A);
  const essBefore = db.getEssence(USER_A);
  const sacRes = db.sacrificeWeapons(USER_A, 'all');
  assert.strictEqual(sacRes.sacrificed, 5);
  assert.strictEqual(sacRes.skipped, 1);
  assert.strictEqual(db.getEssence(USER_A), essBefore + sacRes.essence);
  console.log(`Bulk sacrificed 5 weapons for ${sacRes.essence} essence, skipped 1 equipped`);

  // Sacrifice single weapon by ID
  const singleSacRes = db.sacrificeWeapon(inv2[0].id, USER_A);
  assert.strictEqual(singleSacRes.ok, true);
  assert.strictEqual(db.getWeaponInv(USER_A).length, 0);
  console.log(`Single sacrificed equipped weapon #${inv2[0].id}`);

  // 3. Test Contract Auto-Settlement & Achievements
  // Create contract from USER_A to USER_B for 3 hunts, reward 50000
  const cRes = db.createContract(USER_A, USER_B, 'hunt', 3, 50000);
  assert.strictEqual(cRes.ok, true);
  const cId = cRes.id;

  // Accept contract
  const accRes = db.acceptContract(cId, USER_B);
  assert.strictEqual(accRes.ok, true);
  let contract = db.getContract(cId);
  assert.strictEqual(contract.status, 'active');
  assert.strictEqual(contract.progress, 0);

  // Add progress 1
  db.trackProgress(USER_B, 'hunt', 1);
  contract = db.getContract(cId);
  assert.strictEqual(contract.progress, 1);
  assert.strictEqual(contract.status, 'active');

  // Add progress 2 (reaching objective_n = 3) -> should auto-settle!
  db.trackProgress(USER_B, 'hunt', 2);
  contract = db.getContract(cId);
  assert.strictEqual(contract.progress, 3);
  assert.strictEqual(contract.status, 'completed');
  assert.strictEqual(contract.finished, 1);
  console.log('Contract auto-settled immediately on reaching objective_n!');

  // Verify delivery created for USER_B
  const deliveries = db.getPendingDeliveries(USER_B);
  assert.strictEqual(deliveries.length, 1);
  assert.strictEqual(deliveries[0].amount, 50000);
  console.log(`Delivery created in inbox for target: ${deliveries[0].amount} coins`);

  // Verify achievements / titles unlocked for both target and creator
  const achB = db.getAchievements(USER_B);
  const achA = db.getAchievements(USER_A);
  console.log('Target achievements:', achB);
  console.log('Creator achievements:', achA);
  assert.strictEqual(achB.includes('contract_1'), true, 'Target should have contract_1 achievement');
  assert.strictEqual(achA.includes('contract_1'), true, 'Creator should have contract_1 achievement');

  // Verify titles
  const titlesB = db.getTitles(USER_B);
  const titlesA = db.getTitles(USER_A);
  console.log('Target titles:', titlesB);
  console.log('Creator titles:', titlesA);

  // Clean up test data
  db.exec(`DELETE FROM users WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM weapons_inv WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM animals WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM contracts WHERE creator_id IN ('${USER_A}', '${USER_B}') OR target_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM achievements WHERE user_id IN ('${USER_A}', '${USER_B}')`);
  db.exec(`DELETE FROM user_titles WHERE user_id IN ('${USER_A}', '${USER_B}')`);

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
