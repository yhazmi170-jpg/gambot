// fix-balance.js — directly UPDATE user balance/columns from a pre-wipe snapshot
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
    const opts = { hostname: 'api.github.com', path: url, method, headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'gambot-fix', 'Content-Type': 'application/json' } };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${data.slice(0, 200)}`)); else resolve(data ? JSON.parse(data) : null); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function download(filePath) {
  const d = await request('GET', `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}`);
  return d && d.content ? Buffer.from(d.content, 'base64') : null;
}

async function main() {
  const SQL = await initSqlJs();
  const currentBuf = fs.readFileSync(DB_PATH);
  const currentDb = new SQL.Database(new Uint8Array(currentBuf));

  // Check current balance
  const cur = currentDb.exec(`SELECT balance FROM users WHERE user_id = '${TARGET_USER}'`);
  const curBal = cur.length && cur[0].values.length ? cur[0].values[0][0] : 'not found';
  console.log(`Current balance: ${curBal}`);

  // Find snapshot with the real pre-wipe balance
  const commits = await request('GET', `/repos/${OWNER}/${REPO}/commits?path=backups&per_page=5`);
  const allPaths = new Set();
  for (const commit of commits) {
    const tree = await request('GET', `/repos/${OWNER}/${REPO}/git/trees/${commit.sha}?recursive=1`);
    (tree.tree || []).filter(t => t.type === 'blob' && /^backups\/gambot-.*\.db$/.test(t.path)).forEach(t => allPaths.add(t.path));
  }
  const snapshots = [...allPaths].sort((a, b) => b.localeCompare(a));

  let foundBalance = null;
  let foundSnap = null;
  let backupDb = null;

  for (const snap of snapshots) {
    try {
      const buf = await download(snap);
      if (!buf) continue;
      const db = new SQL.Database(new Uint8Array(buf));
      const res = db.exec(`SELECT balance FROM users WHERE user_id = '${TARGET_USER}'`);
      if (res.length && res[0].values.length) {
        const bal = res[0].values[0][0];
        if (bal > 1000) {
          foundBalance = bal;
          foundSnap = snap;
          backupDb = db;
          console.log(`Found pre-wipe balance ${bal} in ${snap}`);
          break;
        }
      }
      db.close();
    } catch (e) {}
  }

  if (!backupDb) {
    console.error('Could not find a snapshot with balance > 1000!');
    currentDb.close();
    process.exit(1);
  }

  // Get all columns from backup users row
  const colsRes = backupDb.exec('PRAGMA table_info(users)');
  const backupCols = colsRes[0].values.map(v => v[1]);

  const curColsRes = currentDb.exec('PRAGMA table_info(users)');
  const curColSet = new Set(curColsRes[0].values.map(v => v[1]));

  const intersectCols = backupCols.filter(c => curColSet.has(c) && c !== 'user_id');

  // Get backup row data
  const colList = intersectCols.join(', ');
  const dataRes = backupDb.exec(`SELECT ${colList} FROM users WHERE user_id = '${TARGET_USER}'`);
  if (!dataRes.length || !dataRes[0].values.length) {
    console.error('User not found in backup!');
    backupDb.close();
    currentDb.close();
    process.exit(1);
  }

  const row = dataRes[0].values[0];
  const setClause = intersectCols.map((c, i) => {
    const val = row[i];
    if (typeof val === 'string') return `${c} = '${val.replace(/'/g, "''")}'`;
    return `${c} = ${val === null ? 'NULL' : val}`;
  }).join(', ');

  console.log(`Updating users row with balance=${foundBalance}...`);
  currentDb.run(`UPDATE users SET ${setClause} WHERE user_id = '${TARGET_USER}'`);

  // Also restore related tables that might have been lost
  const tablesToRestore = ['animals', 'teams', 'marriages', 'adoption', 'clan_members', 'clans', 'purchases', 'achievements', 'quests', 'bounties', 'streaks', 'weekly_lb', 'hunt_cooldowns', 'checklist_daily', 'checklist_weekly', 'battlepass', 'boss_contrib', 'vault_deposits', 'plots', 'lottery', 'stocks'];
  let totalRows = 0;

  for (const table of tablesToRestore) {
    try {
      const bColsRes = backupDb.exec(`PRAGMA table_info(${table})`);
      if (!bColsRes.length || !bColsRes[0].values.length) continue;
      const cColsRes = currentDb.exec(`PRAGMA table_info(${table})`);
      const cColSet = new Set(cColsRes[0].values.map(v => v[1]));
      const cols = bColsRes[0].values.map(v => v[1]).filter(c => cColSet.has(c));
      if (!cols.includes('user_id')) continue;

      const bColList = cols.join(', ');
      const bData = backupDb.exec(`SELECT ${bColList} FROM ${table} WHERE user_id = '${TARGET_USER}'`);
      if (!bData.length || !bData[0].values.length) continue;

      // Delete existing rows for this user in current DB then insert
      try { currentDb.run(`DELETE FROM ${table} WHERE user_id = '${TARGET_USER}'`); } catch {}

      for (const r of bData[0].values) {
        const placeholders = cols.map(v => {
          const colName = v;
          const colIdx = cols.indexOf(colName);
          const val = r[colIdx];
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          return val;
        }).join(', ');
        try {
          currentDb.run(`INSERT INTO ${table} (${bColList}) VALUES (${placeholders})`);
          totalRows++;
        } catch {}
      }
      console.log(`  ${table}: ${bData[0].values.length} rows`);
    } catch (e) {}
  }

  // Handle pet_achievements via animals
  try {
    const animalIds = backupDb.exec(`SELECT id FROM animals WHERE user_id = '${TARGET_USER}'`);
    if (animalIds.length && animalIds[0].values.length) {
      const paColsRes = backupDb.exec('PRAGMA table_info(pet_achievements)');
      const paCols = paColsRes[0].values.map(v => v[1]);
      for (const [aid] of animalIds[0].values) {
        const paData = backupDb.exec(`SELECT ${paCols.join(', ')} FROM pet_achievements WHERE animal_id = ${aid}`);
        if (paData.length && paData[0].values.length) {
          const curAid = currentDb.exec(`SELECT id FROM animals WHERE user_id = '${TARGET_USER}'`);
          // animals were just restored, use the same IDs
          for (const r of paData[0].values) {
            const placeholders = paCols.map((c, i) => {
              const v = r[i];
              if (v === null) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
              return v;
            }).join(', ');
            try { currentDb.run(`INSERT OR REPLACE INTO pet_achievements (${paCols.join(', ')}) VALUES (${placeholders})`); totalRows++; } catch {}
          }
        }
      }
    }
  } catch {}

  // Save
  const newData = currentDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(newData));
  currentDb.close();
  backupDb.close();

  console.log(`\nDone! Updated users row + ${totalRows} related rows. Balance restored to ${foundBalance}.`);
  console.log('Push and restart immediately so boot restore does not overwrite.');
}

main().catch(e => { console.error(e); process.exit(1); });
