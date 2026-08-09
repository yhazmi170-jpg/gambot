const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('gambot.db');
  const db = new SQL.Database(new Uint8Array(buf));

  // 1. Reset the wrong account back to its pre-corruption balance
  db.run(`UPDATE users SET balance = 32588385 WHERE user_id = '554257220523655199'`);
  console.log('Reset 554257220523655199 back to 32,588,385');

  // 2. Create the correct @极极 account with 84M
  db.run(`INSERT OR REPLACE INTO users (user_id, balance, terms_accepted, total_gambled, total_won) VALUES ('804544396702908427', 84027070, 1, 0, 0)`);
  console.log('Created 804544396702908427 with 84,027,070');

  // Verify
  const r = db.exec(`SELECT user_id, balance FROM users WHERE user_id IN ('804544396702908427', '554257220523655199')`);
  console.log('\nVerification:');
  r[0].values.forEach(v => console.log(v[0], '->', Number(v[1]).toLocaleString()));

  const data = db.export();
  fs.writeFileSync('gambot.db', Buffer.from(data));
  db.close();
  console.log('\nDone!');
}

main().catch(e => console.error(e));
