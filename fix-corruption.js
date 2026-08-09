const initSqlJs = require('sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('gambot.db');
  const db = new SQL.Database(new Uint8Array(buf));

  console.log('=== BEFORE FIX ===');
  const before = db.exec("SELECT user_id, balance FROM users WHERE balance > 1e12 ORDER BY balance DESC");
  before[0].values.forEach(r => console.log(r[0], '->', Number(r[1]).toLocaleString()));

  // Delete the 2 fake/mult accounts with absurd balances
  const fakes = ['100000000000000000', 'mult-1786034511096'];
  for (const uid of fakes) {
    const check = db.exec(`SELECT balance FROM users WHERE user_id = '${uid}'`);
    if (check.length && check[0].values.length) {
      const bal = Number(check[0].values[0][0]);
      if (bal > 1e12) {
        console.log(`\nDeleting fake account ${uid} with balance ${bal.toLocaleString()}`);
        // Delete from all related tables
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

  // Reset owner balance (can't delete owner)
  const ownerCheck = db.exec("SELECT balance FROM users WHERE user_id = '536278876247162882'");
  if (ownerCheck.length && ownerCheck[0].values.length) {
    const ownerBal = Number(ownerCheck[0].values[0][0]);
    if (ownerBal > 1e12) {
      console.log(`\nResetting owner balance from ${ownerBal.toLocaleString()} to 0`);
      db.run("UPDATE users SET balance = 0, total_gambled = 0, total_won = 0 WHERE user_id = '536278876247162882'");
    }
  }

  console.log('\n=== AFTER FIX ===');
  const after = db.exec("SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 10");
  after[0].values.forEach(r => console.log(r[0], '->', Number(r[1]).toLocaleString()));

  // Also check for negative balances
  const neg = db.exec("SELECT user_id, balance FROM users WHERE balance < 0");
  if (neg.length && neg[0].values.length) {
    console.log('\n=== NEGATIVE BALANCES ===');
    neg[0].values.forEach(r => console.log(r[0], '->', Number(r[1]).toLocaleString()));
    for (const [uid] of neg[0].values) {
      db.run(`UPDATE users SET balance = 0 WHERE user_id = '${uid}'`);
    }
    console.log('Fixed negative balances to 0');
  }

  // Save
  const data = db.export();
  fs.writeFileSync('gambot.db', Buffer.from(data));
  db.close();

  console.log('\nDone! Fixed and saved.');
}

main().catch(e => console.error(e));
