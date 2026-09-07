const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
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

// sha256 of a DB buffer — used for seed detection + metadata, never for auth
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Bundled dev/test seed DB — must NEVER be pushed as production or booted silently
const SEED_PATH = path.join(__dirname, 'seed.db');
let _seedHash = null;
function seedHash() {
  if (_seedHash === null) {
    if (fs.existsSync(SEED_PATH)) {
      try { _seedHash = sha256(fs.readFileSync(SEED_PATH)); _seedHash = _seedHash || ''; }
      catch { _seedHash = ''; }
    } else { _seedHash = ''; }
  }
  return _seedHash;
}
function isSeed(buf) {
  const sh = seedHash();
  return !!sh && sh === sha256(buf);
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
  console.log(`backup: DB_PATH=${DB_PATH}, exists=${fs.existsSync(DB_PATH)}`);
  if (!fs.existsSync(DB_PATH)) { console.log('backup: no db file, skipping'); return; }
  const buf = fs.readFileSync(DB_PATH);
  console.log(`backup: DB size=${buf.length} bytes`);
  const dbHash = sha256(buf).slice(0, 16);
  console.log(`backup: sha256=${dbHash}`);

  // Guard: NEVER upload the bundled seed DB as production data
  if (isSeed(buf)) {
    console.error(`backup: SKIPPED — DB is byte-identical to bundled seed.db (${dbHash}); refusing to push seed as production backup`);
    return;
  }

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
      message: `backup ${new Date().toISOString()} db_hash=${dbHash}`,
      content,
      branch: BRANCH,
    });

    // 2) mirror at the legacy single-file path (restore fallback / manual checks)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let sha = null;
        try {
          const existing = await request('GET', `/repos/${OWNER}/${REPO}/contents/gambot.db`);
          sha = existing.sha;
        } catch {}
        await request('PUT', `/repos/${OWNER}/${REPO}/contents/gambot.db`, {
          message: `backup ${new Date().toISOString()} db_hash=${dbHash}`,
          content,
          sha,
          branch: BRANCH,
        });
        break;
      } catch (e) {
        if (e.message && e.message.includes('409') && attempt < 2) {
          console.log(`backup: gambot.db conflict, retry ${attempt + 1}/3`);
          await new Promise(r => setTimeout(r, 1000));
        } else { throw e; }
      }
    }

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

// Validate a downloaded/local DB buffer before it is accepted: structure + real users + not the bundled seed
async function tryAccept(buf, source) {
  if (!buf || buf.length < 1000) { console.error(`restore: skip ${source} — empty/short (${buf ? buf.length : 0} bytes)`); return null; }
  const err = await validateDB(buf);
  if (err) { console.error(`restore: skip ${source} — invalid (${err})`); return null; }
  const users = await countUsers(buf);
  if (users <= 0) { console.error(`restore: skip ${source} — 0 users (empty/corrupt)`); return null; }
  if (isSeed(buf)) { console.error(`restore: skip ${source} — equals bundled seed.db; refusing seed as production`); return null; }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, DB_PATH); // atomic swap — no partial DB
  return { users, sha256: sha256(buf) };
}

async function restore() {
  console.log(`restore: DB_PATH=${DB_PATH}, TOKEN=${TOKEN ? TOKEN.slice(0,8)+'...' : 'MISSING'}`);
  let local = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 100;
  const localMtime = local ? fs.statSync(DB_PATH).mtimeMs : 0;
  console.log(`restore: local=${local}, localMtime=${localMtime}`);
  const info = { ok: false, source: null, seed: false, users: 0, sha256: null };

  let localBuf = null;
  if (local) {
    localBuf = fs.readFileSync(DB_PATH);
    const localErr = await validateDB(localBuf);
    const localCorrupt = await detectCorruption(localBuf);
    if (localErr || localCorrupt) {
      console.log(`local DB is corrupt (${localErr || localCorrupt}), forcing restore from backup`);
      local = false;
      localBuf = null;
    }
  }

  // Remote newest snapshot date (only meaningful when token works)
  let newest = null;
  try { newest = await newestSnapshot(); } catch (e) { console.error('restore: snapshot lookup failed:', e.message); }

  // A valid local DB that's not seed is usable as long as it's at least as new as the cloud.
  if (local && localBuf && !isSeed(localBuf)) {
    if (newest && newest.date > localMtime) {
      const remote = await tryRemoteRestore(newest);
      if (remote) { Object.assign(info, remote); return info; }
      console.log('restore: cloud restore failed; keeping valid local DB');
    } else {
      console.log('restore: local DB is valid and up to date — keeping it');
    }
    const users = await countUsers(localBuf);
    Object.assign(info, { ok: true, source: 'local', seed: false, users, sha256: sha256(localBuf) });
    return info;
  }

  // No valid local DB — restore from remote sources (newest→oldest snapshots, then golden, then mirror).
  if (newest || !local) {
    const remote = await tryRemoteRestore(newest);
    if (remote) { Object.assign(info, remote); return info; }
  }

  // Last resort ONLY if this is not a production host: bundled seed (index.js enforces the no-seed-boot rule).
  const onRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL);
  if (!onRender && fs.existsSync(SEED_PATH)) {
    const buf = fs.readFileSync(SEED_PATH);
    if (buf.length > 1000) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, buf);
      const users = await countUsers(buf);
      console.log(`restore: WARNING — fell back to bundled seed.db (${buf.length} bytes, users=${users}); this is NOT production data`);
      Object.assign(info, { ok: true, source: 'seed', seed: true, users, sha256: sha256(buf) });
      return info;
    }
  }

  console.log('restore: ALL FALLBACKS FAILED — no valid production backup available');
  return info;
}

async function tryRemoteRestore(newest) {
  // Newest → oldest snapshots; accept the first VALID non-seed DB
  try {
    const all = await allSnapshots();
    console.log(`restore: scanning ${all.length} snapshots (newest→oldest)`);
    for (const p of all) {
      try {
        const buf = await download(p);
        const acc = await tryAccept(buf, `snapshot ${p}`);
        if (acc) {
          console.log(`restored DB from cloud snapshot ${p} (users=${acc.users}, sha256=${acc.sha256.slice(0,16)})`);
          return { ok: true, source: `snapshot:${path.basename(p)}`, seed: false, ...acc };
        }
      } catch (e) { console.error(`restore: skip ${p}: ${e.message}`); }
    }
  } catch (e) { console.error('restore: snapshot listing failed:', e.message); }

  // Golden fallback
  try {
    const buf = await download('golden.db');
    const acc = await tryAccept(buf, 'golden.db');
    if (acc) {
      console.log(`restored DB from golden backup (users=${acc.users}, sha256=${acc.sha256.slice(0,16)})`);
      return { ok: true, source: 'golden', seed: false, ...acc };
    }
  } catch (e) { console.log('no golden backup available:', e.message); }

  // Legacy mirror fallback
  try {
    const buf = await download('gambot.db');
    const acc = await tryAccept(buf, 'gambot.db mirror');
    if (acc) {
      console.log(`restored DB from gambot.db mirror (users=${acc.users}, sha256=${acc.sha256.slice(0,16)})`);
      return { ok: true, source: 'mirror', seed: false, ...acc };
    }
  } catch (e) { console.log('no mirror backup available:', e.message); }

  return null;
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

module.exports = { backup, restore, validateDB, saveGoldenBackup, isSeed, sha256, countUsers };
