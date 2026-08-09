const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync('gambot.db')));
  const ids = ['alt-1786033753939', 'alt-1786033710016'];

  for (const uid of ids) {
    const r = db.exec(`SELECT user_id, balance, total_gambled, total_won, level, created_at FROM users WHERE user_id = '${uid}'`);
    if (r.length && r[0].values.length) {
      console.log(uid + ':');
      r[0].columns.forEach((c, i) => console.log('  ' + c + ':', r[0].values[0][i]));
    } else {
      console.log(uid + ': NOT FOUND');
    }
    console.log();
  }

  db.close();
}

main().catch(e => console.error(e));
