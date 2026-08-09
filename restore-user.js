// restore-user.js — restore a single user from a GitHub backup snapshot
// Usage: node restore-user.js <userId> [snapshotPath]
const fs = require('fs');
const path = require('path');
const https = require('https');
const initSqlJs = require('sql.js');
const config = require('./config');

const TOKEN = process.env.GITHUB_TOKEN || config.github_token;
const OWNER = 'yhazmi170-jpg';
const REPO = 'gambot-data';
const BRANCH = 'main';
const DB_PATH = process.env.DB_PATH ? path.join(process.env.DB_PATH, 'gambot.db') : path.join(__dirname, 'gambot.db');

const TARGET_USER = process.argv[2] || '1518469610335244339';

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: url,
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'User-Agent': 'gambot-restore',
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${data.slice(0, 200)}`));
        else resolve(data ? JSON.parse(data) : null);
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function allSnapshots() {
  const commits = await request('GET', `/repos/${OWNER}/${REPO}/commits?path=backups&per_page=5`);
  if (!commits || !commits.length) return [];
  const allPaths = new Set();
  for (const commit of commits) {
    const tree = await request('GET', `/repos/${OWNER}/${REPO}/git/trees/${commit.sha}?recursive=1`);
    (tree.tree || [])
      .filter(t => t.type === 'blob' && /^backups\/gambot-.*\.db$/.test(t.path))
      .forEach(t => allPaths.add(t.path));
  }
  return [...allPaths].sort((a, b) => b.localeCompare(a)); // newest first
}

function snapshotTimestamp(path) {
  const m = path.match(/gambot-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  if (!m) return null;
  return new Date(m[1].replace(/-/g, ':').replace('T', 'T') + 'Z').getTime();
}

async function download(filePath) {
  const d = await request('GET', `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}`);
  return d && d.content ? Buffer.from(d.content, 'base64') : null;
}

async function main() {
  console.log(`Looking for snapshots containing user ${TARGET_USER}...`);

  const snapshots = await allSnapshots();
  console.log(`Found ${snapshots.length} snapshots total`);

  const SQL = await initSqlJs();

  // Find the newest snapshot that contains the target user
  let backupBuf = null;
  let backupPath = null;

  if (process.argv[3]) {
    // Explicit snapshot path provided
    backupPath = process.argv[3];
    console.log(`Using specified snapshot: ${backupPath}`);
    backupBuf = await download(backupPath);
  } else {
    // Search newest -> oldest for one containing the user
    for (const snap of snapshots) {
      const ts = snapshotTimestamp(snap);
      const dateStr = ts ? new Date(ts).toISOString() : 'unknown';
      process.stdout.write(`  checking ${snap} (${dateStr})... `);
      try {
        const buf = await download(snap);
        if (!buf) { console.log('download failed'); continue; }
        const db = new SQL.Database(new Uint8Array(buf));
        const res = db.exec(`SELECT COUNT(*) FROM users WHERE user_id = '${TARGET_USER}'`);
        const count = (res[0] && res[0].values[0][0]) || 0;
        db.close();
        if (count > 0) {
          console.log('FOUND user!');
          backupBuf = buf;
          backupPath = snap;
          break;
        } else {
          console.log('not found');
        }
      } catch (e) {
        console.log(`error: ${e.message}`);
      }
    }
  }

  if (!backupBuf) {
    console.error(`Could not find user ${TARGET_USER} in any snapshot!`);
    process.exit(1);
  }

  console.log(`\nLoading backup from ${backupPath}...`);
  const backupDb = new SQL.Database(new Uint8Array(backupBuf));

  // Verify user exists in backup
  const userCheck = backupDb.exec(`SELECT user_id, balance, terms_accepted FROM users WHERE user_id = '${TARGET_USER}'`);
  if (!userCheck.length || !userCheck[0].values.length) {
    console.error(`User ${TARGET_USER} not found in backup!`);
    backupDb.close();
    process.exit(1);
  }
  const userData = userCheck[0].values[0];
  console.log(`User found in backup: balance=${userData[1]}, terms_accepted=${userData[2]}`);

  // Load current DB
  console.log('Loading current DB...');
  const currentBuf = fs.readFileSync(DB_PATH);
  const currentDb = new SQL.Database(new Uint8Array(currentBuf));

  // Check if user already exists in current DB
  const currentCheck = currentDb.exec(`SELECT COUNT(*) FROM users WHERE user_id = '${TARGET_USER}'`);
  const currentExists = (currentCheck[0] && currentCheck[0].values[0][0]) || 0;
  if (currentExists > 0) {
    console.log('User already exists in current DB (fresh wiped state). Deleting fresh row first...');
    currentDb.run(`DELETE FROM users WHERE user_id = '${TARGET_USER}'`);
  }

  // Tables with user_id FK to restore
  const userTables = [
    'users', 'animals', 'teams', 'hunt_cooldowns', 'custom_roles', 'autohunts',
    'stocks', 'quests', 'bounties', 'vault_deposits', 'achievements', 'streaks',
    'weekly_lb', 'lottery', 'purchases', 'plots', 'checklist_daily', 'checklist_weekly',
    'battlepass', 'boss_contrib', 'clan_members', 'clan_war_fighters', 'giveaways'
  ];

  let totalRestored = 0;

  for (const table of userTables) {
    try {
      // Get columns from both DBs and intersect (handle schema drift)
      const backupColsRes = backupDb.exec(`PRAGMA table_info(${table})`);
      const currentColsRes = currentDb.exec(`PRAGMA table_info(${table})`);
      if (!backupColsRes.length || !backupColsRes[0].values.length) continue;

      const currentColSet = new Set(currentColsRes[0].values.map(v => v[1]));
      const columns = backupColsRes[0].values.map(v => v[1]).filter(c => currentColSet.has(c));
      if (columns.length === 0) continue;
      const colList = columns.join(', ');

      // Get user data from backup (only intersecting columns)
      const dataRes = backupDb.exec(`SELECT ${colList} FROM ${table} WHERE user_id = '${TARGET_USER}'`);
      if (!dataRes.length || !dataRes[0].values.length) continue;

      for (const row of dataRes[0].values) {
        const placeholders = columns.map(() => '?').join(', ');
        const stmt = currentDb.prepare(`INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`);
        stmt.run(row);
        stmt.free();
        totalRestored++;
      }
      console.log(`  ${table}: restored ${dataRes[0].values.length} rows`);
    } catch (e) {
      console.log(`  ${table}: error - ${e.message}`);
    }
  }

  // Bidirectional tables
  const bidirTables = [
    { table: 'marriages', cols: ['user_id', 'partner_id'] },
    { table: 'adoption', cols: ['parent_id', 'child_id'] },
    { table: 'pending_battles', cols: ['challenger_id', 'target_id'] },
    { table: 'pvp_bounties', cols: ['poster_id', 'target_id'] },
    { table: 'bids', cols: ['seller_id', 'current_bidder'] },
  ];

  for (const { table, cols } of bidirTables) {
    try {
      const colsRes = backupDb.exec(`PRAGMA table_info(${table})`);
      if (!colsRes.length || !colsRes[0].values.length) continue;
      const columns = colsRes[0].values.map(v => v[1]);
      const colList = columns.join(', ');

      const conditions = cols.map(c => `${c} = '${TARGET_USER}'`).join(' OR ');
      const dataRes = backupDb.exec(`SELECT ${colList} FROM ${table} WHERE ${conditions}`);
      if (!dataRes.length || !dataRes[0].values.length) continue;

      for (const row of dataRes[0].values) {
        const placeholders = columns.map(() => '?').join(', ');
        const stmt = currentDb.prepare(`INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`);
        stmt.run(row);
        stmt.free();
        totalRestored++;
      }
      console.log(`  ${table}: restored ${dataRes[0].values.length} rows (bidirectional)`);
    } catch (e) {
      console.log(`  ${table}: error - ${e.message}`);
    }
  }

  // pet_achievements (via animals)
  try {
    const animalIds = backupDb.exec(`SELECT id FROM animals WHERE user_id = '${TARGET_USER}'`);
    if (animalIds.length && animalIds[0].values.length) {
      const paColsRes = backupDb.exec(`PRAGMA table_info(pet_achievements)`);
      const paCols = paColsRes[0].values.map(v => v[1]);
      const paColList = paCols.join(', ');

      for (const [animalId] of animalIds[0].values) {
        const dataRes = backupDb.exec(`SELECT ${paColList} FROM pet_achievements WHERE animal_id = ${animalId}`);
        if (!dataRes.length || !dataRes[0].values.length) continue;
        for (const row of dataRes[0].values) {
          const placeholders = paCols.map(() => '?').join(', ');
          const stmt = currentDb.prepare(`INSERT OR REPLACE INTO pet_achievements (${paColList}) VALUES (${placeholders})`);
          stmt.run(row);
          stmt.free();
          totalRestored++;
        }
      }
      console.log(`  pet_achievements: restored via ${animalIds[0].values.length} animals`);
    }
  } catch (e) {
    console.log(`  pet_achievements: error - ${e.message}`);
  }

  // clans (owner_id)
  try {
    const colsRes = backupDb.exec(`PRAGMA table_info(clans)`);
    if (colsRes.length && colsRes[0].values.length) {
      const columns = colsRes[0].values.map(v => v[1]);
      const colList = columns.join(', ');
      const dataRes = backupDb.exec(`SELECT ${colList} FROM clans WHERE owner_id = '${TARGET_USER}'`);
      if (dataRes.length && dataRes[0].values.length) {
        for (const row of dataRes[0].values) {
          const placeholders = columns.map(() => '?').join(', ');
          const stmt = currentDb.prepare(`INSERT OR REPLACE INTO clans (${colList}) VALUES (${placeholders})`);
          stmt.run(row);
          stmt.free();
          totalRestored++;
        }
        console.log(`  clans: restored ${dataRes[0].values.length} rows (owner)`);
      }
    }
  } catch (e) {
    console.log(`  clans: error - ${e.message}`);
  }

  // merchant_stock — restore sold_to references
  try {
    const colsRes = backupDb.exec(`PRAGMA table_info(merchant_stock)`);
    if (colsRes.length && colsRes[0].values.length) {
      const columns = colsRes[0].values.map(v => v[1]);
      const colList = columns.join(', ');
      const dataRes = backupDb.exec(`SELECT ${colList} FROM merchant_stock WHERE sold_to = '${TARGET_USER}'`);
      if (dataRes.length && dataRes[0].values.length) {
        // Update current DB to restore sold_to
        for (const row of dataRes[0].values) {
          // Find the row by other identifying columns and update sold_to
          const slotCol = columns.indexOf('slot');
          if (slotCol >= 0) {
            const slotVal = row[slotCol];
            currentDb.run(`UPDATE merchant_stock SET sold_to = '${TARGET_USER}' WHERE slot = '${slotVal}'`);
            totalRestored++;
          }
        }
        console.log(`  merchant_stock: restored ${dataRes[0].values.length} sold_to references`);
      }
    }
  } catch (e) {
    console.log(`  merchant_stock: error - ${e.message}`);
  }

  // Save current DB
  const newData = currentDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(newData));

  currentDb.close();
  backupDb.close();

  console.log(`\nDone! Restored ${totalRestored} total rows for user ${TARGET_USER}`);
  console.log('Restart the bot for changes to take effect (Arestart)');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
