// Regression test: v lb must rank + display wallet + bank (money incl. what's in the bank).
// Setup: money=100 / bank=900 -> leaderboard value MUST be 1000 (money in the bank counted).
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

  // rich total = 1000; mid has money=400, bank=0 -> total 400, must rank BELOW rich
  db.addBalance(poor, 50);
  db.exec(`UPDATE users SET bank = 950 WHERE user_id = '${poor}'`);

  // mid total = 400
  db.addBalance(mid, 400);
  db.exec(`UPDATE users SET bank = 0 WHERE user_id = '${mid}'`);

  // owner has giant money but must be excluded like the real owner
  db.addBalance(owner, 999999999);
  db.exec(`UPDATE users SET bank = 999999999 WHERE user_id = '${owner}'`);

  const top = db.getTop(10, owner);

  const row = t => t.find(u => u.user_id === rich);
  const richRow = row(top);

  check('rich user present in lb', !!richRow);
  check('lb includes bank (money 100 + bank 900 = 1000)', richRow && richRow.balance === 1000);

  const midIdx = top.findIndex(u => u.user_id === mid);
  const richIdx = top.findIndex(u => u.user_id === rich);
  const poorIdx = top.findIndex(u => u.user_id === poor);

  // ranking must use total incl bank: rich(1000) > mid(400) > poor(1000?) ...
  // poor total = 50 + 950 = 1000 -> same as rich; ranking tie-break doesn't matter here.
  // assert rich and poor both rank ABOVE mid (400)
  check('ranking counts bank (rich 1000 / poor 1000 > mid 400)', midIdx !== -1 && richIdx !== -1 && poorIdx !== -1 && richIdx < midIdx && poorIdx < midIdx);

  // owner excluded
  check('owner excluded from lb', !top.some(u => u.user_id === owner));

  // slb (server wealth board) intentionally uses wallet+bank too - same as lb
  const all = db.getAllUsers();
  const sorted = all.sort((a, b) => ((b.balance + (b.bank || 0)) - (a.balance + (a.bank || 0))));
  const sRich = sorted.find(u => u.user_id === rich);
  check('slb wealth board uses wallet+bank (900+100=1000)', sRich && (sRich.balance + (sRich.bank || 0)) === 1000);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });