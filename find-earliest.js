const https = require('https');
const initSqlJs = require('sql.js');
const config = require('./config');

const TOKEN = process.env.GITHUB_TOKEN || config.github_token;

function request(method, url) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.github.com', path: url, method, headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'find-earliest', 'Content-Type': 'application/json' } };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { if (res.statusCode >= 400) reject(new Error(res.statusCode)); else resolve(data ? JSON.parse(data) : null); });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const SQL = await initSqlJs();
  const commits = await request('GET', '/repos/yhazmi170-jpg/gambot-data/commits?path=backups&per_page=100');
  const allPaths = new Set();
  for (const commit of commits.slice(0, 10)) {
    const tree = await request('GET', '/repos/yhazmi170-jpg/gambot-data/git/trees/' + commit.sha + '?recursive=1');
    (tree.tree || []).filter(t => t.type === 'blob' && /^backups\/gambot-.*\.db$/.test(t.path)).forEach(t => allPaths.add(t.path));
  }
  const snapshots = [...allPaths].sort((a, b) => a.localeCompare(b));

  console.log('Total snapshots:', snapshots.length);
  console.log('Oldest:', snapshots[0]);
  console.log('Newest:', snapshots[snapshots.length - 1]);

  // Find earliest snapshot with the owner
  for (const snap of snapshots) {
    try {
      const d = await request('GET', '/repos/yhazmi170-jpg/gambot-data/contents/' + encodeURIComponent(snap) + '?ref=main');
      if (!d || !d.content) continue;
      const buf = Buffer.from(d.content, 'base64');
      const db = new SQL.Database(new Uint8Array(buf));
      const owner = db.exec("SELECT balance FROM users WHERE user_id = '536278876247162882'");
      const all = db.exec("SELECT COUNT(*) FROM users");
      db.close();
      const ownerBal = owner.length && owner[0].values.length ? Number(owner[0].values[0][0]) : null;
      const userCount = all[0].values[0][0];
      console.log(snap, '-> users:', userCount, 'owner:', ownerBal !== null ? ownerBal.toLocaleString() : 'N/A');
    } catch (e) {}
  }
}

main().catch(e => console.error(e));
