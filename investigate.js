const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync('gambot.db')));

  console.log('=== TOP 15 BY BALANCE ===');
  const res = db.exec('SELECT user_id, balance, total_gambled, total_won FROM users ORDER BY balance DESC LIMIT 15');
  if (res.length && res[0].values) {
    res[0].values.forEach(r => {
      const bal = Number(r[1]);
      const flags = [];
      if (bal > 1e12) flags.push('OVERFLOW?');
      if (bal < 0) flags.push('NEGATIVE');
      console.log(r[0], '->', bal.toLocaleString(), '| gambled:', Number(r[2]).toLocaleString(), '| won:', Number(r[3]).toLocaleString(), flags.join(' '));
    });
  }

  console.log('\n=== STATS ===');
  const stats = db.exec('SELECT COUNT(*), SUM(balance), AVG(balance), MAX(balance), MIN(balance) FROM users');
  if (stats.length && stats[0].values) {
    const s = stats[0].values[0];
    console.log('Total users:', s[0]);
    console.log('Total balance:', Number(s[1]).toLocaleString());
    console.log('Avg balance:', Number(s[2]).toLocaleString());
    console.log('Max balance:', Number(s[3]).toLocaleString());
    console.log('Min balance:', Number(s[4]).toLocaleString());
  }

  console.log('\n=== BALANCE DISTRIBUTION ===');
  const dist = db.exec('SELECT CASE WHEN balance < 0 THEN "negative" WHEN balance > 1e12 THEN "trillion+" WHEN balance > 1e9 THEN "billion+" WHEN balance > 1e6 THEN "million+" WHEN balance > 1e3 THEN "thousand+" ELSE "small" END as bucket, COUNT(*) FROM users GROUP BY bucket ORDER BY MIN(balance)');
  if (dist.length && dist[0].values) {
    dist[0].values.forEach(r => console.log(r[0], ':', r[1], 'users'));
  }

  console.log('\n=== CHECK SPECIFIC USERS ===');
  const suspects = ['100000000000000000', 'mult-1786034511096'];
  for (const uid of suspects) {
    const r = db.exec(`SELECT * FROM users WHERE user_id = '${uid}'`);
    if (r.length && r[0].values.length) {
      console.log(uid + ':');
      r[0].columns.forEach((c, i) => console.log('  ' + c + ':', r[0].values[0][i]));
    } else {
      console.log(uid + ': NOT FOUND');
    }
  }

  db.close();
}

main().catch(e => console.error(e));
