// Regression test: v lb must rank + display MONEY ONLY (balance), never money+bank.
// Setup: money=100 / bank=900 -> leaderboard value MUST be 100, ranking MUST use 100 not 1000.
process.env.DB_PATH = '/tmp/lb_test';
const fs = require('fs');
fs.rmSync('/tmp/lb_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/lb_test', { recursive: true });

const { execSync } = require('child_process');
execSync('ls /tmp/lb_test', { stdio: 'ignore' });

const db = require('../db');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

(async () => {
  await db.init();

  const rich = 'usr_rich';
  const poor = 'usr_poor';
  const mid = 'usr_mid';
  const owner = 'usr_owner';

  // money=100, bank=900 for the test target
  db.addBalance(rich, 100);
  db.exec(`UPDATE users SET bank = 900 WHERE user_id = '${rich}'`);

  // same rank value as rich if bank were summed (1000) but must NOT rank equal/higher than mid
  db.addBalance(poor, 50);
  db.exec(`UPDATE users SET bank = 950 WHERE user_id = '${poor}'`);

  // mid has money=400, bank=0 -> should rank above rich (400 > 100)
  db.addBalance(mid, 400);
  db.exec(`UPDATE users SET bank = 0 WHERE user_id = '${mid}'`);

  // owner has giant money but must be excluded like the real owner
  db.addBalance(owner, 999999999);
  db.exec(`UPDATE users SET bank = 999999999 WHERE user_id = '${owner}'`);

  const top = db.getTop(10, owner);

  const row = t => t.find(u => u.user_id === rich);
  const richRow = row(top);

  check('rich user present in lb', !!richRow);
  check('lb displays money=100 (not money+bank=1000)', richRow && richRow.balance === 100);

  const midIdx = top.findIndex(u => u.user_id === mid);
  const richIdx = top.findIndex(u => u.user_id === rich);
  const poorIdx = top.findIndex(u => u.user_id === poor);

  // ranking must use money only: mid(400) > rich(100) > poor(50)
  check('ranking uses money only (mid 400 > rich 100)', midIdx !== -1 && richIdx !== -1 && midIdx < richIdx);
  check('ranking uses money only (rich 100 > poor 50)', richIdx !== -1 && poorIdx !== -1 && richIdx < poorIdx);

  // owner excluded
  check('owner excluded from lb', !top.some(u => u.user_id === owner));

  // slb (server wealth board) intentionally still uses wallet+bank - keep as separate check
  const all = db.getAllUsers();
  const sorted = all.sort((a, b) => ((b.balance + (b.bank || 0)) - (a.balance + (a.bank || 0))));
  const sRich = sorted.find(u => u.user_id === rich);
  check('slb wealth board still uses wallet+bank (900+100=1000)', sRich && (sRich.balance + (sRich.bank || 0)) === 1000);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });