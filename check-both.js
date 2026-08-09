const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('gambot.db');
  const db = new SQL.Database(new Uint8Array(buf));

  const ids = ['804544396702908427', '554257220523655199'];

  for (const uid of ids) {
    const r = db.exec(`SELECT user_id, balance, total_gambled, total_won FROM users WHERE user_id = '${uid}'`);
    if (r.length && r[0].values.length) {
      console.log(`${uid}: balance=${Number(r[0].values[0][1]).toLocaleString()}, gambled=${Number(r[0].values[0][2]).toLocaleString()}, won=${Number(r[0].values[0][3]).toLocaleString()}`);
    } else {
      console.log(`${uid}: NOT FOUND`);
    }
  }

  db.close();
}

main().catch(e => console.error(e));
