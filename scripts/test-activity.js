// Regression test: v activity analytics — getTopCommandUsers / getMostUsedCommands / getTopWinners / getActivitySummary
process.env.DB_PATH = '/tmp/activity_test';
const fs = require('fs');
fs.rmSync('/tmp/activity_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/activity_test', { recursive: true });

const db = require('../db');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

(async () => {
  await db.init();

  const u1 = 'act_user_1';
  const u2 = 'act_user_2';
  const u3 = 'act_user_3';
  const owner = 'act_owner';

  // production handler always acceptTerms/creates users before execute — mirror
  // that here so addGambled/addWon (UPDATE users) actually land.
  for (const id of [u1, u2, u3, owner]) db.acceptTerms(id);

  // u1 is the most active: uses hunt 5x, hunt works for feature usage
  for (let i = 0; i < 5; i++) db.recordFeatureUse(u1, 'hunt');
  db.recordFeatureUse(u1, 'battle');
  db.recordFeatureUse(u2, 'hunt');
  db.recordFeatureUse(u2, 'hunt');
  db.recordFeatureUse(u2, 'slots');
  db.recordFeatureUse(u3, 'slots');
  db.recordFeatureUse(owner, 'hunt'); // owner should be excluded from user boards

  // gambling + wins counters
  db.addGambled(u2, 10000);
  db.addGambled(u1, 5000);
  db.addGambled(owner, 999999999); // owner gambled huge, must not top the board
  db.addWon(u3, 20000);
  db.addWon(u1, 15000);

  const topUsers = db.getTopCommandUsers(10, owner);
  check('top user is u1 (5+1=6 commands)', topUsers.length && topUsers[0].user_id === u1, JSON.stringify(topUsers));
  check('u1 total counts all uses', topUsers.length && topUsers[0].total === 6);
  check('u1 distinct features = 2', topUsers.length && topUsers[0].features === 2);
  check('owner excluded from top users', !topUsers.some(u => u.user_id === owner));
  check('u2 has 3 commands', topUsers.some(u => u.user_id === u2 && u.total === 3));

  const topCmds = db.getMostUsedCommands(10);
  check('hunt is most used command', topCmds.length && topCmds[0].feature === 'hunt', JSON.stringify(topCmds));
  check('hunt used 8 times across 3 users', topCmds.length && topCmds[0].total === 8 && topCmds[0].users === 3);

  const topWins = db.getTopWinners(10, owner);
  check('top winner is u3', topWins.length && topWins[0].user_id === u3, JSON.stringify(topWins));
  check('u3 won 20000', topWins.length && topWins[0].total_won === 20000);
  check('owner excluded from winners', !topWins.some(u => u.user_id === owner));

  const sum = db.getActivitySummary();
  check('summary has 4 users', sum && sum.total_users === 4, JSON.stringify(sum));
  check('summary total commands = 11', sum && sum.total_commands === 11);
  check('summary has 4 active today', sum && sum.active_day === 4);
  check('summary has 4 active this week', sum && sum.active_week === 4);

  // cap + format safety
  const capped = db.getTopCommandUsers(100, owner);
  check('limit capped at 20', capped.length <= 20, String(capped.length));
  const one = db.getTopCommandUsers(0, owner);
  check('limit 0 falls back to 10', one.length <= 10, String(one.length));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });