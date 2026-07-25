const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('./config.json');

const DB_PATH = process.env.DB_PATH ? path.join(process.env.DB_PATH, 'gambot.db') : path.join(__dirname, 'gambot.db');
const TOKEN = config.token;
const OWNER = 'yhazmi170-jpg';
const REPO = 'gambot-data';
const BRANCH = 'main';

async function backup() {
  if (!fs.existsSync(DB_PATH)) return;
  const content = fs.readFileSync(DB_PATH).toString('base64');

  // Check if repo exists, create if not
  await request('GET', `/repos/${OWNER}/${REPO}`).catch(async () => {
    await request('POST', '/user/repos', { name: REPO, private: true });
  });

  // Get current file SHA if exists
  let sha = null;
  try {
    const existing = await request('GET', `/repos/${OWNER}/${REPO}/contents/gambot.db`);
    sha = existing.sha;
  } catch {}

  // Upload DB
  await request('PUT', `/repos/${OWNER}/${REPO}/contents/gambot.db`, {
    message: `backup ${new Date().toISOString()}`,
    content,
    sha,
    branch: BRANCH,
  });
  console.log('backed up to github');
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
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${data}`));
        else resolve(data ? JSON.parse(data) : null);
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = backup;
