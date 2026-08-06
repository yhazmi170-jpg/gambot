const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('./config');

const DB_PATH = process.env.DB_PATH ? path.join(process.env.DB_PATH, 'gambot.db') : path.join(__dirname, 'gambot.db');
const TOKEN = process.env.GITHUB_TOKEN || config.github_token;
const OWNER = 'yhazmi170-jpg';
const REPO = 'gambot-data';
const BRANCH = 'main';

// Timestamped snapshot name — sorts lexically = chronologically
function snapshotName() {
  return `gambot-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
}

async function backup() {
  if (!fs.existsSync(DB_PATH)) { console.log('backup: no db file, skipping'); return; }
  const content = fs.readFileSync(DB_PATH).toString('base64');

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

async function restore() {
  const local = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 100;
  const localMtime = local ? fs.statSync(DB_PATH).mtimeMs : 0;

  let newest = null;
  try { newest = await newestSnapshot(); } catch (e) { console.error('restore: snapshot lookup failed:', e.message); }

  if (newest) {
    // Stale local DB? If the newest snapshot is NEWER than the local file, replace it —
    // prevents an old instance from running on (and re-backing-up) outdated data.
    if (local && newest.date <= localMtime) {
      console.log('local db is up to date, skipping restore');
      return true;
    }
    try {
      const buf = await download(newest.path);
      if (buf) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        fs.writeFileSync(DB_PATH, buf);
        console.log(`restored db from github backup (${newest.path})`);
        return true;
      }
    } catch (e) {
      console.error('restore: snapshot download failed:', e.message);
    }
  }

  // Fallback: legacy single-file backup
  try {
    const buf = await download('gambot.db');
    if (buf) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, buf);
      console.log('restored db from github backup (gambot.db mirror)');
      return true;
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

module.exports = { backup, restore };
