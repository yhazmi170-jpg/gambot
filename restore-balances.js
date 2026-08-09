const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('gambot.db');
  const db = new SQL.Database(new Uint8Array(buf));

  // First, find all user IDs
  const allUsers = db.exec('SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 20');
  console.log('=== CURRENT TOP 20 ===');
  allUsers[0].values.forEach(r => console.log(r[0], '->', Number(r[1]).toLocaleString()));

  // Known corrections from user's "correct" leaderboard
  const corrections = {};
  const knownIds = {
    '554257220523655199': { name: '@极极', correct: 84027070 },
    '1403284736071172137': { name: '@Aruh', correct: 50799601 },
    '1092161180900008126': { name: '@meimei', correct: 41468607 },
    '1518469610335244339': { name: '@البلي', correct: 32867719 }
  };

  // Find remaining users by querying for names in the leaderboard
  // @⃟, @nini, @mie's owner | sisi, @Adam, @Claire🦇, @apzz
  // We'll search by balance proximity or just ask user for IDs

  console.log('\n=== APPLYING KNOWN CORRECTIONS ===');
  for (const [uid, info] of Object.entries(knownIds)) {
    const current = db.exec(`SELECT balance FROM users WHERE user_id = '${uid}'`);
    if (current.length && current[0].values.length) {
      const curBal = Number(current[0].values[0][0]);
      const diff = info.correct - curBal;
      db.run(`UPDATE users SET balance = ${info.correct} WHERE user_id = '${uid}'`);
      console.log(`${info.name}: ${curBal.toLocaleString()} -> ${info.correct.toLocaleString()} (${diff > 0 ? '+' : ''}${diff.toLocaleString()})`);
    } else {
      console.log(`${info.name}: NOT FOUND`);
    }
  }

  const data = db.export();
  fs.writeFileSync('gambot.db', Buffer.from(data));
  db.close();
  console.log('\nDone! Known balances corrected.');
}

main().catch(e => console.error(e));
