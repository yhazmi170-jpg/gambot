const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const TOKEN = process.env.GITHUB_TOKEN || config.github_token;
const DB_PATH = path.join(__dirname, 'gambot.db');

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.github.com', path: url, method, headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'nuke', 'Content-Type': 'application/json' } };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { if (res.statusCode >= 400) reject(new Error(res.statusCode + ': ' + data.slice(0, 300))); else resolve(data ? JSON.parse(data) : null); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get the latest commit touching backups/
  const commits = await request('GET', '/repos/yhazmi170-jpg/gambot-data/commits?path=backups&per_page=1');
  const latestSha = commits[0].sha;
  console.log('Latest commit:', latestSha);

  // Get the tree
  const tree = await request('GET', `/repos/yhazmi170-jpg/gambot-data/git/trees/${latestSha}?recursive=1`);
  const backups = (tree.tree || []).filter(t => t.type === 'blob' && /^backups\/.*\.db$/.test(t.path));

  console.log(`Found ${backups.length} backup files. Deleting all...`);

  // Delete each backup file
  for (const file of backups) {
    try {
      await request('DELETE', `/repos/yhazmi170-jpg/gambot-data/contents/${encodeURIComponent(file.path)}`, {
        message: `delete corrupt backup ${file.path}`,
        sha: file.sha,
        branch: 'main'
      });
      console.log('  deleted:', file.path);
    } catch (e) {
      console.log('  failed to delete:', file.path, e.message);
    }
  }

  // Now push our corrected backup
  const buf = fs.readFileSync(DB_PATH);
  const content = buf.toString('base64');
  const snapName = `backups/gambot-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;

  console.log('\nPushing corrected backup:', snapName);
  await request('PUT', `/repos/yhazmi170-jpg/gambot-data/contents/${encodeURIComponent(snapName)}`, {
    message: 'clean backup - all corrupt backups removed',
    content,
    branch: 'main'
  });

  console.log('\nDone! Only the corrected backup remains.');
}

main().catch(e => console.error(e));
