const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync('gambot.db')));

  const guilds = db.exec('SELECT COUNT(*) FROM guilds');
  console.log('Guilds in DB:', guilds[0].values[0][0]);

  const channels = db.exec('SELECT COUNT(*) FROM channel_disabled');
  console.log('Channel disabled rows:', channels[0].values[0][0]);

  const users = db.exec('SELECT COUNT(*) FROM users WHERE terms_accepted = 0');
  console.log('Users without TOS:', users[0].values[0][0]);

  db.close();
}

main().catch(e => console.error(e));
