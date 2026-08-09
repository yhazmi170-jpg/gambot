const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('../db');
const config = require('../config');

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// Discord OAuth config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || config.discordClientId || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || config.discordClientSecret || '';
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const DISCORD_API = 'https://discord.com/api/v10';

// Session middleware (memory store for ephemeral Render FS)
app.use(session({
  secret: process.env.SESSION_SECRET || config.sessionSecret || 'gambot-dashboard-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/auth/discord');
}

// Discord OAuth login
app.get('/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).send('Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET env vars.');
  }
  const url = `${DISCORD_API}/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(url);
});

// Discord OAuth callback
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/');

  try {
    // Exchange code for token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token');

    // Get user info
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    // Store in session
    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      global_name: userData.global_name
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('Login failed: ' + err.message);
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Landing page
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Dashboard (protected)
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// API: Get current user's data
app.get('/api/me', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const user = db.ensureUser(userId);
  const balance = db.getBalance(userId);
  const gems = db.getGems(userId);
  const animals = db.getUserAnimals(userId);
  const team = db.getTeam(userId);
  const perks = db.getUserPerks(userId);

  res.json({
    user: req.session.user,
    balance,
    gems,
    animalCount: animals.length,
    team: team ? team.filter(Boolean) : [],
    perks: perks.map(p => p.perk)
  });
});

// API: Leaderboard
app.get('/api/leaderboard', requireAuth, (req, res) => {
  const top = db.getTop(10);
  res.json(top);
});

// API: User's animals
app.get('/api/animals', requireAuth, (req, res) => {
  const animals = db.getUserAnimals(req.session.user.id);
  res.json(animals);
});

// API: Global stats
app.get('/api/stats', requireAuth, (req, res) => {
  const stats = db.exec('SELECT COUNT(*) as users, SUM(balance) as totalBalance FROM users');
  res.json({
    totalUsers: stats[0]?.values[0][0] || 0,
    totalBalance: stats[0]?.values[0][1] || 0
  });
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

module.exports = app;
