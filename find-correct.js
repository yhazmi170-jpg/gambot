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

  const targets = {
    '1403284736071172137': { name: '@Aruh', correct: 50739601 },
    '554257220523655199': { name: '@极极', correct: 83786270 },
    '1092161180900008126': { name: '@meimei', correct: 38627232 }
  };

  console.log('Searching for snapshot with correct balances...\n');

  for (const snap of snapshots) {
    try {
      const d = await request('GET', '/repos/yhazmi170-jpg/gambot-data/contents/' + encodeURIComponent(snap) + '?ref=main');
      if (!d || !d.content) continue;
      const buf = Buffer.from(d.content, 'base64');
      const db = new SQL.Database(new Uint8Array(buf));
      const res = db.exec("SELECT user_id, balance FROM users WHERE user_id IN ('1403284736071172137','554257220523655199','1092161180900008126')");
      db.close();

      if (res.length && res[0].values.length >= 3) {
        const balances = {};
        res[0].values.forEach(r => { balances[r[0]] = Number(r[1]); });

        const aruh = balances['1403284736071172137'];
        const jiji = balances['554257220523655199'];
        const meimei = balances['1092161180900008126'];

        // Check if this snapshot has correct-ish balances (within 10% of target)
        const aruhOk = aruh && Math.abs(aruh - 50739601) / 50739601 < 0.1;
        const jijiOk = jiji && Math.abs(jiji - 83786270) / 83786270 < 0.1;
        const meimeiOk = meimei && Math.abs(meimei - 38627232) / 38627232 < 0.1;

        const allOk = aruhOk && jijiOk && meimeiOk;
        console.log(snap, 'Aruh:', aruh?.toLocaleString(), '极极:', jiji?.toLocaleString(), 'meimei:', meimei?.toLocaleString(), allOk ? '*** CORRECT ***' : '');

        if (allOk) {
          console.log('\n=== FOUND CORRECT SNAPSHOT ===');
          console.log(snap);
          break;
        }
      }
    } catch (e) {}
  }
}

main().catch(e => console.error(e));
