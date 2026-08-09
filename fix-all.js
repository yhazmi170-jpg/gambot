const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('gambot.db');
  const db = new SQL.Database(new Uint8Array(buf));

  // Apply ALL corrections from user's correct leaderboard
  const corrections = {
    '554257220523655199': { name: '@极极', correct: 84027070 },
    '1403284736071172137': { name: '@Aruh', correct: 50799601 },
    '1092161180900008126': { name: '@meimei', correct: 41468607 },
    '1518469610335244339': { name: '@البلي', correct: 32867719 },
    '1520302042588123226': { name: '@nini', correct: 8754321 },
    '1362950980114845696': { name: '@apzz', correct: 2230138 },
    '1357992664317820983': { name: '@Claire', correct: 2331666 }
  };

  console.log('=== APPLYING ALL CORRECTIONS ===\n');

  for (const [uid, info] of Object.entries(corrections)) {
    const current = db.exec(`SELECT balance FROM users WHERE user_id = '${uid}'`);
    if (current.length && current[0].values.length) {
      const curBal = Number(current[0].values[0][0]);
      if (curBal !== info.correct) {
        db.run(`UPDATE users SET balance = ${info.correct} WHERE user_id = '${uid}'`);
        console.log(`${info.name}: ${curBal.toLocaleString()} -> ${info.correct.toLocaleString()}`);
      }
    }
  }

  const data = db.export();
  fs.writeFileSync('gambot.db', Buffer.from(data));
  db.close();
  console.log('\nDone!');
}

main().catch(e => console.error(e));
