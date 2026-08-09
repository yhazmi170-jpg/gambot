// Local dashboard runner — doesn't start the Discord bot
const db = require('../db');

async function main() {
  await db.init();
  console.log('[web] DB initialized');
  const app = require('./server');
}

main().catch(e => console.error(e));
