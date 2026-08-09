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

  const commits = await request('GET', '/repos/yhazmi170-jpg/gambot-data/commits?path=backups&per_page=100');
  const allPaths = new Set();
  for (const commit of commits.slice(0, 10)) {
    const tree = await request('GET', '/repos/yhazmi170-jpg/gambot-data/git/trees/' + commit.sha + '?recursive=1');
    (tree.tree || []).filter(t => t.type === 'blob' && /^backups\/gambot-.*\.db$/.test(t.path)).forEach(t => allPaths.add(t.path));
  }
  const snapshots = [...allPaths].sort((a, b) => b.localeCompare(a)); // newest first

  // Target exact balances from the correct leaderboard
  const targets = {
    '554257220523655199': { name: '@极极', bal: 84027070 },
    '1403284736071172137': { name: '@Aruh', bal: 50799601 },
    '1092161180900008126': { name: '@meimei', bal: 41468607 },
    '1518469610335244339': { name: '@البلي', bal: 32867719 }
  };

  console.log('Searching for snapshot with EXACT correct balances...\n');

  for (const snap of snapshots) {
    try {
      const d = await request('GET', '/repos/yhazmi170-jpg/gambot-data/contents/' + encodeURIComponent(snap) + '?ref=main');
      if (!d || !d.content) continue;
      const buf = Buffer.from(d.content, 'base64');
      const db = new SQL.Database(new Uint8Array(buf));
      const res = db.exec("SELECT user_id, balance FROM users WHERE user_id IN ('554257220523655199','1403284736071172137','1092161180900008126','1518469610335244339')");
      db.close();

      if (res.length && res[0].values.length >= 4) {
        const balances = {};
        res[0].values.forEach(r => { balances[r[0]] = Number(r[1]); });

        let allMatch = true;
        for (const [uid, info] of Object.entries(targets)) {
          const actual = balances[uid];
          if (!actual || Math.abs(actual - info.bal) > 1000) {
            allMatch = false;
            break;
          }
        }

        if (allMatch) {
          console.log('=== FOUND EXACT MATCH ===');
          console.log(snap);
          for (const [uid, info] of Object.entries(targets)) {
            console.log(`  ${info.name}: ${balances[uid]?.toLocaleString()}`);
          }
          // Don't break — keep searching for the NEWEST one that matches
        }
      }
    } catch (e) {}
  }
}

main().catch(e => console.error(e));
