const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || process.env.RENDER_DISK_PATH ? path.join(process.env.DB_PATH || process.env.RENDER_DISK_PATH, 'gambot.db') : path.join(__dirname, '..', 'gambot.db');
let db = null;
let SQL = null;

async function init() {
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      terms_accepted INTEGER NOT NULL DEFAULT 0,
      daily_time INTEGER NOT NULL DEFAULT 0,
      daily_streak INTEGER NOT NULL DEFAULT 0,
      weekly_time INTEGER NOT NULL DEFAULT 0,
      work_time INTEGER NOT NULL DEFAULT 0,
      total_gambled INTEGER NOT NULL DEFAULT 0,
      total_won INTEGER NOT NULL DEFAULT 0,
      lucky INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS lottery (
      user_id TEXT PRIMARY KEY,
      tickets INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id TEXT PRIMARY KEY,
      disabled_commands TEXT NOT NULL DEFAULT '[]'
    );
  `);
  try { db.run(`ALTER TABLE users ADD COLUMN daily_streak INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN lucky INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN insurance INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN rep_time INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN auto_react_emoji TEXT NOT NULL DEFAULT ''`); } catch (e) {}
  db.run(`CREATE TABLE IF NOT EXISTS marriages (user_id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, married_at INTEGER NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS adoption (parent_id TEXT, child_id TEXT, PRIMARY KEY (parent_id, child_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS purchases (user_id TEXT, perk TEXT, expires_at INTEGER, PRIMARY KEY (user_id, perk))`);
  db.run(`CREATE TABLE IF NOT EXISTS log_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS vip_roles (guild_id TEXT PRIMARY KEY, role_id TEXT NOT NULL)`);
  save();
}

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

const START_BALANCE = 1000;
const DAY = 86400;

function ensureUser(userId) {
  const row = db.exec(`SELECT * FROM users WHERE user_id = '${userId}'`);
  if (row.length && row[0].values.length) {
    const vals = row[0].values[0];
    return {
      user_id: vals[0],
      balance: vals[1],
      terms_accepted: vals[2],
      daily_time: vals[3],
      daily_streak: vals[4],
      weekly_time: vals[5],
      work_time: vals[6],
      total_gambled: vals[7],
      total_won: vals[8],
      lucky: vals[9],
      created_at: vals[10],
      insurance: vals[11] || 0,
      reputation: vals[12] || 0,
      rep_time: vals[13] || 0,
      auto_react_emoji: vals[14] || '',
    };
  }
  return null;
}

function isRegistered(userId) {
  const u = ensureUser(userId);
  return u && u.terms_accepted === 1;
}

function acceptTerms(userId) {
  const existing = ensureUser(userId);
  if (existing) {
    db.run(`UPDATE users SET terms_accepted = 1, balance = ${START_BALANCE} WHERE user_id = '${userId}'`);
  } else {
    db.run(`INSERT INTO users (user_id, balance, terms_accepted) VALUES ('${userId}', ${START_BALANCE}, 1)`);
  }
  save();
}

function getBalance(userId) {
  return ensureUser(userId).balance;
}

function addBalance(userId, amount) {
  let u = ensureUser(userId);
  if (!u) {
    db.run(`INSERT INTO users (user_id, balance) VALUES ('${userId}', 0)`);
    u = ensureUser(userId);
  }
  const newBal = u.balance + amount;
  db.run(`UPDATE users SET balance = ${newBal} WHERE user_id = '${userId}'`);
  save();
}

function setBalance(userId, amount) {
  db.run(`UPDATE users SET balance = ${amount} WHERE user_id = '${userId}'`);
  save();
}

function calcDailyReward(user, hasCap) {
  const now = Math.floor(Date.now() / 1000);
  let streak = 0;
  if (user.daily_time > 0 && (now - user.daily_time) < DAY * 2) {
    streak = user.daily_streak + 1;
  }
  const max = hasCap ? 15000 : 5000;
  const reward = Math.min(1000 + streak * 500, max);
  return { reward, streak, max };
}

function claimDaily(userId) {
  const user = ensureUser(userId);
  const now = Math.floor(Date.now() / 1000);
  let streak = 0;
  if (user.daily_time > 0 && (now - user.daily_time) < DAY * 2) {
    streak = user.daily_streak + 1;
  }
  const hasCap = hasPerk(userId, 'daily_cap');
  const max = hasCap ? 15000 : 5000;
  const reward = Math.min(1000 + streak * 500, max);
  db.run(`UPDATE users SET daily_time = ${now}, daily_streak = ${streak}, balance = balance + ${reward} WHERE user_id = '${userId}'`);
  save();
  return { reward, streak, max };
}

function claimWeekly(userId, amount) {
  const now = Math.floor(Date.now() / 1000);
  db.run(`UPDATE users SET weekly_time = ${now}, balance = balance + ${amount} WHERE user_id = '${userId}'`);
  save();
}

function claimWork(userId, amount) {
  const now = Math.floor(Date.now() / 1000);
  db.run(`UPDATE users SET work_time = ${now}, balance = balance + ${amount} WHERE user_id = '${userId}'`);
  save();
}

function getCooldown(lastTime, cooldownSec) {
  if (!lastTime) return 0;
  const elapsed = Date.now() / 1000 - lastTime;
  return Math.max(0, cooldownSec - elapsed);
}

function addGambled(userId, amount) {
  db.run(`UPDATE users SET total_gambled = total_gambled + ${amount} WHERE user_id = '${userId}'`);
  save();
}

function addWon(userId, amount) {
  db.run(`UPDATE users SET total_won = total_won + ${amount} WHERE user_id = '${userId}'`);
  save();
}

function getTop(limit) {
  const rows = db.exec(`SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], balance: v[1] }));
}

function getLottery() {
  const rows = db.exec('SELECT * FROM lottery ORDER BY tickets DESC');
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], tickets: v[1] }));
}

function addTicket(userId, amount) {
  const existing = db.exec(`SELECT tickets FROM lottery WHERE user_id = '${userId}'`);
  if (existing.length && existing[0].values.length) {
    const current = existing[0].values[0][0];
    db.run(`UPDATE lottery SET tickets = ${current + amount} WHERE user_id = '${userId}'`);
  } else {
    db.run(`INSERT INTO lottery (user_id, tickets) VALUES ('${userId}', ${amount})`);
  }
  save();
}

function resetLottery() {
  db.run('DELETE FROM lottery');
  save();
}

function totalTickets() {
  const rows = db.exec('SELECT COALESCE(SUM(tickets), 0) as total FROM lottery');
  return { total: rows.length ? rows[0].values[0][0] : 0 };
}

function toggleLucky(userId) {
  const u = ensureUser(userId);
  if (!u) return null;
  const newVal = u.lucky ? 0 : 1;
  db.run(`UPDATE users SET lucky = ${newVal} WHERE user_id = '${userId}'`);
  save();
  return newVal === 1;
}

function getGuild(guildId) {
  const rows = db.exec(`SELECT * FROM guilds WHERE guild_id = '${guildId}'`);
  if (rows.length && rows[0].values.length) {
    return { guild_id: rows[0].values[0][0], disabled_commands: JSON.parse(rows[0].values[0][1] || '[]') };
  }
  db.run(`INSERT INTO guilds (guild_id) VALUES ('${guildId}')`);
  save();
  return getGuild(guildId);
}

function disableCommand(guildId, cmdName) {
  const guild = getGuild(guildId);
  const list = guild.disabled_commands;
  if (cmdName === 'all') {
    db.run(`UPDATE guilds SET disabled_commands = '["all"]' WHERE guild_id = '${guildId}'`);
  } else if (!list.includes(cmdName) && !list.includes('all')) {
    list.push(cmdName);
    db.run(`UPDATE guilds SET disabled_commands = '${JSON.stringify(list)}' WHERE guild_id = '${guildId}'`);
  }
  save();
}

function enableCommand(guildId, cmdName) {
  const guild = getGuild(guildId);
  if (cmdName === 'all') {
    db.run(`UPDATE guilds SET disabled_commands = '[]' WHERE guild_id = '${guildId}'`);
  } else {
    const list = guild.disabled_commands.filter(c => c !== cmdName && c !== 'all');
    db.run(`UPDATE guilds SET disabled_commands = '${JSON.stringify(list)}' WHERE guild_id = '${guildId}'`);
  }
  save();
}

function isCommandDisabled(guildId, cmdName) {
  if (!guildId) return false;
  const guild = getGuild(guildId);
  return guild.disabled_commands.includes('all') || guild.disabled_commands.includes(cmdName);
}

function setLogChannel(guildId, channelId) {
  db.run(`INSERT OR REPLACE INTO log_channels (guild_id, channel_id) VALUES ('${guildId}', '${channelId}')`);
  save();
}

function getLogChannel(guildId) {
  const rows = db.exec(`SELECT channel_id FROM log_channels WHERE guild_id = '${guildId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0];
}

function getMaxBet(userId) {
  return hasPerk(userId, 'bet_cap') ? 500000 : 250000;
}

function getInsuranceRefund(userId, lossAmount) {
  const u = ensureUser(userId);
  if (u && u.insurance) return Math.floor(lossAmount * 0.2);
  return 0;
}

function toggleInsurance(userId) {
  const u = ensureUser(userId);
  if (!u) return null;
  const newVal = u.insurance ? 0 : 1;
  db.run(`UPDATE users SET insurance = ${newVal} WHERE user_id = '${userId}'`);
  save();
  return newVal === 1;
}

function getMarriage(userId) {
  const rows = db.exec(`SELECT * FROM marriages WHERE user_id = '${userId}' OR partner_id = '${userId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const vals = rows[0].values[0];
  return { user_id: vals[0], partner_id: vals[1], married_at: vals[2] };
}

function setMarriage(userId, partnerId) {
  const now = Math.floor(Date.now() / 1000);
  db.run(`INSERT OR REPLACE INTO marriages (user_id, partner_id, married_at) VALUES ('${userId}', '${partnerId}', ${now})`);
  save();
}

function deleteMarriage(userId) {
  db.run(`DELETE FROM marriages WHERE user_id = '${userId}' OR partner_id = '${userId}'`);
  save();
}

function getChildren(parentId) {
  const rows = db.exec(`SELECT child_id FROM adoption WHERE parent_id = '${parentId}'`);
  if (!rows.length) return [];
  return rows[0].values.map(v => v[0]);
}

function getParents(childId) {
  const rows = db.exec(`SELECT parent_id FROM adoption WHERE child_id = '${childId}'`);
  if (!rows.length) return [];
  return rows[0].values.map(v => v[0]);
}

function adoptChild(parentId, childId) {
  db.run(`INSERT OR IGNORE INTO adoption (parent_id, child_id) VALUES ('${parentId}', '${childId}')`);
  save();
}

function unadoptChild(parentId, childId) {
  db.run(`DELETE FROM adoption WHERE parent_id = '${parentId}' AND child_id = '${childId}'`);
  save();
}

function hasPerk(userId, perk) {
  const rows = db.exec(`SELECT expires_at FROM purchases WHERE user_id = '${userId}' AND perk = '${perk}'`);
  if (!rows.length || !rows[0].values.length) return false;
  const expires = rows[0].values[0][0];
  if (expires > 0 && expires < Math.floor(Date.now() / 1000)) {
    db.run(`DELETE FROM purchases WHERE user_id = '${userId}' AND perk = '${perk}'`);
    save();
    return false;
  }
  return true;
}

function addPerk(userId, perk, expiresAt) {
  const now = Math.floor(Date.now() / 1000);
  db.run(`INSERT OR REPLACE INTO purchases (user_id, perk, expires_at) VALUES ('${userId}', '${perk}', ${expiresAt || 0})`);
  save();
}

function removePerk(userId, perk) {
  db.run(`DELETE FROM purchases WHERE user_id = '${userId}' AND perk = '${perk}'`);
  save();
}

function getExpiredSubs() {
  const now = Math.floor(Date.now() / 1000);
  const rows = db.exec(`SELECT user_id, perk FROM purchases WHERE expires_at > 0 AND expires_at < ${now}`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], perk: v[1] }));
}

function getRep(userId) {
  const u = ensureUser(userId);
  return u ? u.reputation : 0;
}

function addRep(giverId, receiverId, amount) {
  const now = Math.floor(Date.now() / 1000);
  db.run(`UPDATE users SET rep_time = ${now}, reputation = reputation + ${amount} WHERE user_id = '${receiverId}'`);
  save();
}

function setAutoReactEmoji(userId, emoji) {
  db.run(`UPDATE users SET auto_react_emoji = '${emoji}' WHERE user_id = '${userId}'`);
  save();
}

function getAutoReactEmoji(userId) {
  const u = ensureUser(userId);
  return u ? u.auto_react_emoji : '';
}

function getVipRole(guildId) {
  const rows = db.exec(`SELECT role_id FROM vip_roles WHERE guild_id = '${guildId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0];
}

function setVipRole(guildId, roleId) {
  db.run(`INSERT OR REPLACE INTO vip_roles (guild_id, role_id) VALUES ('${guildId}', '${roleId}')`);
  save();
}

function getUserPerks(userId) {
  const rows = db.exec(`SELECT perk, expires_at FROM purchases WHERE user_id = '${userId}'`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ perk: v[0], expires_at: v[1] }));
}

module.exports = {
  init,
  ensureUser,
  isRegistered,
  acceptTerms,
  getBalance,
  addBalance,
  setBalance,
  claimDaily,
  calcDailyReward,
  claimWeekly,
  claimWork,
  getCooldown,
  addGambled,
  addWon,
  getTop,
  getLottery,
  addTicket,
  resetLottery,
  totalTickets,
  getGuild,
  disableCommand,
  enableCommand,
  isCommandDisabled,
  toggleLucky,
  toggleInsurance,
  setLogChannel,
  getLogChannel,
  getInsuranceRefund,
  getMaxBet,
  getMarriage,
  setMarriage,
  deleteMarriage,
  getChildren,
  getParents,
  adoptChild,
  unadoptChild,
  hasPerk,
  addPerk,
  removePerk,
  getExpiredSubs,
  getUserPerks,
  getRep,
  addRep,
  getVipRole,
  setVipRole,
  setAutoReactEmoji,
  getAutoReactEmoji,
  START_BALANCE,
};
