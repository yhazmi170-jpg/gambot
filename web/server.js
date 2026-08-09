const express = require('express');
const path = require('path');
const db = require('../db');
const config = require('../config');

const app = express();
const PORT = process.env.WEB_PORT || 3001;

app.use(express.static(path.join(__dirname, 'public')));

// Dashboard (local — shows owner data)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// API: Owner's data
app.get('/api/me', (req, res) => {
  const userId = config.ownerId;
  const user = db.ensureUser(userId);
  const balance = db.getBalance(userId);
  const gems = db.getGems(userId);
  const animals = db.getUserAnimals(userId);
  const team = db.getTeam(userId);
  const perks = db.getUserPerks(userId);

  res.json({
    user: { id: userId, username: 'Owner' },
    balance,
    gems,
    animalCount: animals.length,
    team: team ? team.filter(Boolean) : [],
    perks: perks.map(p => p.perk)
  });
});

// API: Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const top = db.getTop(10);
  res.json(top);
});

// API: Global stats
app.get('/api/stats', (req, res) => {
  const stats = db.exec('SELECT COUNT(*) as users, SUM(balance) as totalBalance FROM users');
  res.json({
    totalUsers: stats[0]?.values[0][0] || 0,
    totalBalance: stats[0]?.values[0][1] || 0
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[web] dashboard running at http://localhost:${PORT}`);
});

module.exports = app;
