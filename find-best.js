const https = require('https');
const initSqlJs = require('sql.js');
const config = require('./config');

const TOKEN = process.env.GITHUB_TOKEN || config.github_token;

function request(method, url) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.github.com', path: url, method, headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'search', 'Content-Type': 'application/json' } };
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
  for (const commit of commits.slice(0, 5)) {
    const tree = await request('GET', '/repos/yhazmi170-jpg/gambot-data/git/trees/' + commit.sha + '?recursive=1');
    (tree.tree || []).filter(t => t.type === 'blob' && /^backups\/gambot-.*\.db$/.test(t.path)).forEach(t => allPaths.add(t.path));
  }
  const snapshots = [...allPaths].sort((a, b) => b.localeCompare(a));

  console.log('Checking newest 30 snapshots for @极极 balance...\n');

  let bestSnap = null;
  let bestBal = 0;

  for (const snap of snapshots.slice(0, 30)) {
    try {
      const d = await request('GET', '/repos/yhazmi170-jpg/gambot-data/contents/' + encodeURIComponent(snap) + '?ref=main');
      if (!d || !d.content) continue;
      const buf = Buffer.from(d.content, 'base64');
      const db = new SQL.Database(new Uint8Array(buf));

      // Check for absurd balances
      const absurd = db.exec("SELECT COUNT(*) FROM users WHERE balance > 1000000000000");
      const absurdCount = absurd.length && absurd[0].values.length ? absurd[0].values[0][0] : 0;

      // Get @极极 balance
      const jiji = db.exec("SELECT balance FROM users WHERE user_id = '554257220523655199'");
      const jijiBal = jiji.length && jiji[0].values.length ? Number(jiji[0].values[0][0]) : null;

      // Get @meimei balance
      const meimei = db.exec("SELECT balance FROM users WHERE user_id = '1092161180900008126'");
      const meiBal = meimei.length && meimei[0].values.length ? Number(meimei[0].values[0][0]) : null;

      // Get @Aruh balance
      const aruh = db.exec("SELECT balance FROM users WHERE user_id = '1403284736071172137'");
      const aruhBal = aruh.length && aruh[0].values.length ? Number(aruh[0].values[0][0]) : null;

      db.close();

      const corrupt = absurdCount > 0 ? 'CORRUPT' : 'CLEAN';
      console.log(snap, '| 极极:', jijiBal?.toLocaleString(), '| Aruh:', aruhBal?.toLocaleString(), '| meimei:', meiBal?.toLocaleString(), '|', corrupt);

      if (absurdCount === 0 && jijiBal && jijiBal > bestBal) {
        bestBal = jijiBal;
        bestSnap = snap;
      }
    } catch (e) {}
  }

  if (bestSnap) {
    console.log('\n=== BEST CLEAN SNAPSHOT (highest @极极 balance) ===');
    console.log(bestSnap, '-> @极极:', bestBal.toLocaleString());
    console.log('\nNote: This is LESS than the "correct" 84M because the corruption');
    console.log('drained @极极 BEFORE any backup captured the 84M state.');
  }
}

main().catch(e => console.error(e));
