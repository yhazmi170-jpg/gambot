const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('gambot.db');
  const db = new SQL.Database(new Uint8Array(buf));

  // Remaining corrections from user's IDs
  const corrections = {
    '1533177575554154758': { name: '@Adam', correct: 2536270 },
    '1520302042588123226': { name: '@nini', correct: 8754321 },
    '1362950980114845696': { name: '@apzz', correct: 2230138 },
    '1357992664317820983': { name: '@Claire', correct: 2331666 },
    '1485370482826940466': { name: '@sisi', correct: 3885848 }
  };

  console.log('=== APPLYING REMAINING CORRECTIONS ===\n');

  for (const [uid, info] of Object.entries(corrections)) {
    const current = db.exec(`SELECT balance FROM users WHERE user_id = '${uid}'`);
    if (current.length && current[0].values.length) {
      const curBal = Number(current[0].values[0][0]);
      const diff = info.correct - curBal;
      db.run(`UPDATE users SET balance = ${info.correct} WHERE user_id = '${uid}'`);
      console.log(`${info.name}: ${curBal.toLocaleString()} -> ${info.correct.toLocaleString()} (${diff > 0 ? '+' : ''}${diff.toLocaleString()})`);
    } else {
      console.log(`${info.name}: USER NOT FOUND (${uid})`);
    }
  }

  const data = db.export();
  fs.writeFileSync('gambot.db', Buffer.from(data));
  db.close();
  console.log('\nDone!');
}

main().catch(e => console.error(e));
