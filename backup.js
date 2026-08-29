const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('./config');

const DB_PATH = process.env.DB_PATH ? path.join(process.env.DB_PATH, 'gambot.db') : path.join(__dirname, 'gambot.db');
const TOKEN = process.env.GITHUB_TOKEN || config.github_token;
const OWNER = 'yhazmi170-jpg';
const REPO = 'gambot-data-v3';
const BRANCH = 'main';

// Timestamped snapshot name — sorts lexically = chronologically
function snapshotName() {
  return `gambot-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
}

// Validate DB structure and integrity
async function validateDB(buf) {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buf));

    // Check required tables exist
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values.map(v => v[0]) || [];
    const required = ['users', 'animals', 'purchases', 'guilds'];
    for (const t of required) {
      if (!tableNames.includes(t)) { db.close(); return `missing_table:${t}`; }
    }

    // Check users table has required columns
    const cols = db.exec("PRAGMA table_info(users)");
    const colNames = cols[0]?.values.map(v => v[1]) || [];
    const requiredCols = ['user_id', 'balance', 'terms_accepted', 'gems'];
    for (const c of requiredCols) {
      if (!colNames.includes(c)) { db.close(); return `missing_col:users.${c}`; }
    }

    // Check for absurd balances
    const absurd = db.exec("SELECT COUNT(*) FROM users WHERE balance > 1000000000000 OR balance < -1000000000000");
    if (absurd[0]?.values[0][0] > 0) { db.close(); return 'absurd_balances'; }

    // Check for negative gems/essence
    const neg = db.exec("SELECT COUNT(*) FROM users WHERE gems < 0 OR essence < 0");
    if (neg[0]?.values[0][0] > 0) { db.close(); return 'negative_resources'; }

    db.close();
    return null; // valid
  } catch (e) { return `parse_error:${e.message}`; }
}

// Save a "golden" backup — a known-good state that persists
async function saveGoldenBackup(buf) {
  try {
    const content = buf.toString('base64');
    let sha = null;
    try {
      const existing = await request('GET', `/repos/${OWNER}/${REPO}/contents/golden.db`);
      sha = existing.sha;
    } catch {}
    await request('PUT', `/repos/${OWNER}/${REPO}/contents/golden.db`, {
      message: `golden backup ${new Date().toISOString()}`,
      content,
      sha,
      branch: BRANCH,
    });
    console.log('golden backup saved');
  } catch (e) {
    console.error('golden backup failed:', e.message);
  }
}

// Count rows in `users` inside an SQLite buffer (0 = empty/corrupt DB we must never push or restore)
async function countUsers(buf) {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buf));
    const res = db.exec('SELECT COUNT(*) FROM users');
    db.close();
    return (res[0] && res[0].values[0][0]) || 0;
  } catch { return -1; }
}

async function detectCorruption(buf) {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buf));

    // Check 1: known active user in wiped state (fresh-default stats)
    const wiped = db.exec("SELECT user_id FROM users WHERE user_id = '1518469610335244339' AND balance <= 1000 AND total_gambled = 0 AND total_won = 0");
    if (wiped.length && wiped[0].values.length) return `wiped:${wiped[0].values[0][0]}`;

    // Check 2: any user with absurdly high balance (>1T = corruption/overflow)
    const absurd = db.exec("SELECT user_id, balance FROM users WHERE balance > 1000000000000 ORDER BY balance DESC LIMIT 3");
    if (absurd.length && absurd[0].values.length) {
      const list = absurd[0].values.map(r => `${r[0]}=${Number(r[1]).toLocaleString()}`).join(', ');
      return `absurd:${list}`;
    }

    // Check 3: negative balances
    const neg = db.exec("SELECT user_id, balance FROM users WHERE balance < 0 LIMIT 3");
    if (neg.length && neg[0].values.length) {
      const list = neg[0].values.map(r => `${r[0]}=${Number(r[1]).toLocaleString()}`).join(', ');
      return `negative:${list}`;
    }

    db.close();
    return null;
  } catch { return null; }
}

let backupCounter = 0;

async function backup() {
  if (!fs.existsSync(DB_PATH)) { console.log('backup: no db file, skipping'); return; }
  const buf = fs.readFileSync(DB_PATH);

  // Validate DB structure
  const invalid = await validateDB(buf);
  if (invalid) { console.error(`backup: SKIPPED — DB validation failed (${invalid}); not pushing corrupt data`); return; }

  // Guard: never upload an empty/corrupt DB as the newest snapshot — it would clobber good data on next restore
  const users = await countUsers(buf);
  if (users === 0) { console.error('backup: SKIPPED — local DB has 0 users (empty/corrupt); not overwriting cloud backups'); return; }

  // Guard: refuse to push if DB shows signs of corruption (wiped users, absurd balances, negatives)
  const corrupt = await detectCorruption(buf);
  if (corrupt) { console.error(`backup: SKIPPED — DB corruption detected (${corrupt}); not overwriting good cloud backups`); return; }

  const content = buf.toString('base64');

  try {
    await request('GET', `/repos/${OWNER}/${REPO}`).catch(async () => {
      await request('POST', '/user/repos', { name: REPO, private: true });
    });

    // 1) versioned snapshot — never overwrites, so a stale/bad state can't destroy history
    const snapPath = `backups/${snapshotName()}`;
    await request('PUT', `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(snapPath)}`, {
      message: `backup ${new Date().toISOString()}`,
      content,
      branch: BRANCH,
    });

    // 2) mirror at the legacy single-file path (restore fallback / manual checks)
    let sha = null;
    try {
      const existing = await request('GET', `/repos/${OWNER}/${REPO}/contents/gambot.db`);
      sha = existing.sha;
    } catch {}
    await request('PUT', `/repos/${OWNER}/${REPO}/contents/gambot.db`, {
      message: `backup ${new Date().toISOString()}`,
      content,
      sha,
      branch: BRANCH,
    });

    // 3) Golden backup — saved every 10 backups (≈10 min) as a known-good fallback
    backupCounter++;
    if (backupCounter >= 10) {
      backupCounter = 0;
      await saveGoldenBackup(buf);
    }

    console.log(`backed up to github (${snapPath})`);
  } catch (e) {
    console.error('backup FAILED:', e.message);
    throw e;
  }
}

// Newest snapshot: latest commit touching backups/ + its newest *.db file, with commit date
async function newestSnapshot() {
  const commits = await request('GET', `/repos/${OWNER}/${REPO}/commits?path=backups&per_page=1`);
  if (!commits || !commits.length) return null;
  const sha = commits[0].sha;
  const date = new Date(commits[0].commit.author.date).getTime();
  const tree = await request('GET', `/repos/${OWNER}/${REPO}/git/trees/${sha}?recursive=1`);
  const dbs = (tree.tree || [])
    .filter(t => t.type === 'blob' && /^backups\/.*\.db$/.test(t.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!dbs.length) return null;
  return { path: dbs[dbs.length - 1].path, date };
}

async function download(filePath) {
  const d = await request('GET', `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}`);
  return d && d.content ? Buffer.from(d.content, 'base64') : null;
}

// All snapshot filenames in the latest commit touching backups/ (newest first)
async function allSnapshots() {
  const commits = await request('GET', `/repos/${OWNER}/${REPO}/commits?path=backups&per_page=1`);
  if (!commits || !commits.length) return [];
  const tree = await request('GET', `/repos/${OWNER}/${REPO}/git/trees/${commits[0].sha}?recursive=1`);
  return (tree.tree || [])
    .filter(t => t.type === 'blob' && /^backups\/.*\.db$/.test(t.path))
    .map(t => t.path)
    .sort((a, b) => b.localeCompare(a)); // newest filename first
}

async function restore() {
  const local = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 100;
  const localMtime = local ? fs.statSync(DB_PATH).mtimeMs : 0;

  // First: validate local DB — if it's corrupt, force restore from backup
  if (local) {
    const localBuf = fs.readFileSync(DB_PATH);
    const localInvalid = await validateDB(localBuf);
    const localCorrupt = await detectCorruption(localBuf);
    if (localInvalid || localCorrupt) {
      console.log(`local DB is corrupt (${localInvalid || localCorrupt}), forcing restore from backup`);
      local = false; // force restore
    }
  }

  // Scan snapshots newest→oldest; download the first valid one.
  let newest = null;
  try { newest = await newestSnapshot(); } catch (e) { console.error('restore: snapshot lookup failed:', e.message); }

  if (newest && local && newest.date <= localMtime) {
    console.log('local db is up to date, skipping restore');
    return true;
  }

  if (newest || !local) {
    try {
      const all = await allSnapshots();
      for (const p of all) {
        try {
          const buf = await download(p);
          if (buf && (await countUsers(buf)) > 0) {
            const invalid = await validateDB(buf);
            const corrupt = await detectCorruption(buf);
            if (invalid || corrupt) { console.error(`restore: skipped bad snapshot ${p} (${invalid || corrupt})`); continue; }
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, buf);
            console.log(`restored db from github backup (${p})`);
            return true;
          }
        } catch (e) { console.error(`restore: skip ${p}: ${e.message}`); }
      }
    } catch (e) {
      console.error('restore: snapshot listing failed:', e.message);
    }
  }

  // Fallback 1: golden backup
  try {
    const buf = await download('golden.db');
    if (buf && (await countUsers(buf)) > 0) {
      const invalid = await validateDB(buf);
      if (!invalid) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        fs.writeFileSync(DB_PATH, buf);
        console.log('restored db from golden backup');
        return true;
      }
    }
  } catch (e) { console.log('no golden backup available'); }

  // Fallback 2: legacy single-file backup
  try {
    const buf = await download('gambot.db');
    if (buf && (await countUsers(buf)) > 0) {
      const invalid = await validateDB(buf);
      if (!invalid) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        fs.writeFileSync(DB_PATH, buf);
        console.log('restored db from github backup (gambot.db mirror)');
        return true;
      }
    }
  } catch (e) {
    console.log('no backup to restore:', e.message);
  }
  return false;
}

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: url,
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'User-Agent': 'gambot-backup',
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

module.exports = { backup, restore, validateDB, saveGoldenBackup };
