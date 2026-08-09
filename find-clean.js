const https = require('https');
const initSqlJs = require('sql.js');
const config = require('./config');

const TOKEN = process.env.GITHUB_TOKEN || config.github_token;

function request(method, url) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.github.com', path: url, method, headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'find-clean', 'Content-Type': 'application/json' } };
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

  const commits = await request('GET', '/repos/yhazmi170-jpg/gambot-data/commits?path=backups&per_page=50');
  const allPaths = new Set();
  for (const commit of commits) {
    const tree = await request('GET', '/repos/yhazmi170-jpg/gambot-data/git/trees/' + commit.sha + '?recursive=1');
    (tree.tree || []).filter(t => t.type === 'blob' && /^backups\/gambot-.*\.db$/.test(t.path)).forEach(t => allPaths.add(t.path));
  }
  const snapshots = [...allPaths].sort((a, b) => a.localeCompare(b)); // oldest first

  console.log('Scanning ' + snapshots.length + ' snapshots for clean balances...\n');

  for (const snap of snapshots) {
    try {
      const d = await request('GET', '/repos/yhazmi170-jpg/gambot-data/contents/' + encodeURIComponent(snap) + '?ref=main');
      if (!d || !d.content) continue;
      const buf = Buffer.from(d.content, 'base64');
      const db = new SQL.Database(new Uint8Array(buf));
      const res = db.exec("SELECT user_id, balance FROM users WHERE user_id IN ('536278876247162882', '100000000000000000', 'mult-1786034511096') ORDER BY user_id");
      db.close();

      if (res.length && res[0].values.length) {
        const vals = res[0].values.map(r => Number(r[1]));
        const maxBal = Math.max(...vals);
        const hasCorruption = maxBal > 1e12;
        const hasOwner = res[0].values.some(r => r[0] === '536278876247162882');
        console.log(snap, '->', vals.map(v => v.toLocaleString()).join(', '), hasCorruption ? '*** CORRUPT ***' : (hasOwner ? 'CLEAN' : 'no owner'));
        if (!hasCorruption && hasOwner) {
          console.log('\n=== FOUND CLEAN SNAPSHOT ===');
          console.log(snap);
          break;
        }
      } else {
        console.log(snap, '-> target users not found');
      }
    } catch (e) {
      console.log(snap, '-> error:', e.message);
    }
  }
}

main().catch(e => console.error(e));
