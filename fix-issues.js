const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('gambot.db');
  const db = new SQL.Database(new Uint8Array(buf));

  // 1. Delete exploit alt accounts (0 gambled but won money)
  const alts = ['alt-1786033753939', 'alt-1786033710016'];
  for (const uid of alts) {
    const check = db.exec(`SELECT balance, total_gambled, total_won FROM users WHERE user_id = '${uid}'`);
    if (check.length && check[0].values.length) {
      const [bal, gambled, won] = check[0].values[0];
      if (gambled === 0 && won > 0) {
        console.log(`Deleting exploit alt ${uid} (balance=${bal}, gambled=${gambled}, won=${won})`);
        // Delete from all tables
        const tables = ['users', 'animals', 'teams', 'hunt_cooldowns', 'custom_roles', 'autohunts',
          'stocks', 'quests', 'bounties', 'vault_deposits', 'achievements', 'streaks',
          'weekly_lb', 'lottery', 'purchases', 'plots', 'checklist_daily', 'checklist_weekly',
          'battlepass', 'boss_contrib', 'clan_members', 'clan_war_fighters'];
        for (const t of tables) {
          try { db.run(`DELETE FROM ${t} WHERE user_id = '${uid}'`); } catch {}
        }
        try { db.run(`DELETE FROM marriages WHERE user_id = '${uid}' OR partner_id = '${uid}'`); } catch {}
        try { db.run(`DELETE FROM adoption WHERE parent_id = '${uid}' OR child_id = '${uid}'`); } catch {}
      }
    }
  }

  // 2. Reset merchant timer so it doesn't immediately re-arrive after deploy
  const now = Math.floor(Date.now() / 1000);
  db.run(`INSERT OR REPLACE INTO merchant_state (id, next_at) VALUES (1, ${now + 3600})`);
  console.log('Reset merchant timer to 1 hour from now');

  // 3. Mark v1.7.4 as notified so it doesn't re-post on next boot
  try {
    db.run(`INSERT OR REPLACE INTO notifications (key, value) VALUES ('v1.7.4', '1')`);
    console.log('Marked v1.7.4 as notified');
  } catch (e) {
    console.log('notifications table may not exist:', e.message);
  }

  const data = db.export();
  fs.writeFileSync('gambot.db', Buffer.from(data));
  db.close();
  console.log('\nDone!');
}

main().catch(e => console.error(e));
