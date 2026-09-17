// v try recommendation-engine test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/try_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/try_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/try_test', { recursive: true });

const db = require('../db');
const tryCmd = require('../commands/try');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}
function giveSpecies(userId, species, bond = 0, level = 1) {
  db.exec(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense, shiny, bond, level)
           VALUES ('${userId}', '${species.replace(/'/g, "''")}', 'common', 100, 100, 10, 5, 0, ${bond}, ${level})`);
}
const has = (recs, id) => recs.some(r => r.f && r.f.id === id);

(async () => {
  await db.init();
  for (const id of ['try_fresh', 'try_rich']) db.addBalance(id, 0);

  // --- fresh user: gap recommendations fire ---
  let recs = tryCmd.buildRecommendations(tryCmd.buildContext('try_fresh'));
  check('fresh user gets marry nudge', has(recs, 'marry'));
  check('fresh user gets clan nudge', has(recs, 'clan'));
  check('fresh user gets a never-tried feature', recs.some(r => /never touched/.test(r.line)));

  // --- contextual must-acts ---
  db.getQuest('try_rich');
  db.addEgg('try_rich', 2);
  recs = tryCmd.buildRecommendations(tryCmd.buildContext('try_rich'));
  check('unclaimed quest is recommended first', recs[0].f.id === 'quest');
  check('unhatched eggs are recommended', has(recs, 'hatch'));

  // --- dex milestone proximity (8 species -> 2 from the 10 milestone) ---
  const cat = db.dexCatalog().all.slice(0, 8);
  for (const s of cat) giveSpecies('try_rich', s);
  recs = tryCmd.buildRecommendations(tryCmd.buildContext('try_rich'));
  check('near dex milestone is recommended', recs.some(r => /next dex milestone/.test(r.line)));

  // --- pet progression: pet 5 bond from the next tier ---
  giveSpecies('try_rich', cat[0] + ' ', 45);
  recs = tryCmd.buildRecommendations(tryCmd.buildContext('try_rich'));
  check('pet close to next bond tier is recommended', has(recs, 'animal'));

  // --- evolution: a level 10+ pet ---
  giveSpecies('try_rich', cat[1] + '  ', 0, 10);
  const ctx = tryCmd.buildContext('try_rich');
  check('context counts evolvable pets', ctx.evolvable >= 1);
  check('evolvable pets are recommended', has(tryCmd.buildRecommendations(ctx), 'evolve'));

  // --- merchant opportunity ---
  db.refreshMerchant();
  const mctx = tryCmd.buildContext('try_rich');
  check('context sees unsold merchant stock', mctx.merchantUnsold === 3);
  check('merchant stock is recommended', has(tryCmd.buildRecommendations(mctx), 'merchant'));

  // --- summon opt-out is surfaced ---
  db.setSummonOptOut('try_rich', true);
  check('summon opt-out is recommended', has(tryCmd.buildRecommendations(tryCmd.buildContext('try_rich')), 'summon'));

  // --- every recommendation points at a real catalog entry ---
  const all = tryCmd.buildRecommendations(tryCmd.buildContext('try_rich'));
  check('every recommendation resolves to a feature', all.every(r => r.f && r.f.id && r.line));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
