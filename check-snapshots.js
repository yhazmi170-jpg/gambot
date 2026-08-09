const https = require('https');
const config = require('./config');
const TOKEN = process.env.GITHUB_TOKEN || config.github_token;
function req(method, url) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.github.com', path: url, method, headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'check', 'Content-Type': 'application/json' } };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { if (res.statusCode >= 400) reject(new Error(res.statusCode)); else resolve(d ? JSON.parse(d) : null); }); });
    r.on('error', reject); r.end();
  });
}
async function main() {
  const commits = await req('GET', '/repos/yhazmi170-jpg/gambot-data/commits?path=backups&per_page=5');
  for (const c of commits) {
    console.log('Commit:', c.commit.author.date, c.sha.substring(0,7));
    const tree = await req('GET', '/repos/yhazmi170-jpg/gambot-data/git/trees/' + c.sha + '?recursive=1');
    const dbs = (tree.tree || []).filter(t => /^backups\/gambot-.*\.db$/.test(t.path)).map(t => t.path).sort();
    dbs.slice(-2).forEach(d => console.log('  ', d));
  }
}
main().catch(e => console.error(e.message));
