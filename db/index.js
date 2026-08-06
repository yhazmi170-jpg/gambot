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
  try { db.run(`ALTER TABLE users ADD COLUMN badge_emoji TEXT NOT NULL DEFAULT '🏅'`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN lb_emoji TEXT NOT NULL DEFAULT '🌟'`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN bank INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN loan INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN loan_time INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN xp_time INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN gems INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN essence INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN hunt_eff INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN hunt_gain INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN hunt_radar INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN hunt_xp INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN autohunt_level INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN snails INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN snail_time INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN snail_bought INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN snail_buy_day INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN eggs INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN hatched INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN battles_won INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  db.run(`CREATE TABLE IF NOT EXISTS marriages (user_id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, married_at INTEGER NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS adoption (parent_id TEXT, child_id TEXT, PRIMARY KEY (parent_id, child_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS purchases (user_id TEXT, perk TEXT, expires_at INTEGER, PRIMARY KEY (user_id, perk))`);
  db.run(`CREATE TABLE IF NOT EXISTS log_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS cmd_log_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS update_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS vip_roles (guild_id TEXT PRIMARY KEY, role_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS animals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    species TEXT NOT NULL,
    rarity TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Unnamed',
    level INTEGER NOT NULL DEFAULT 1,
    exp INTEGER NOT NULL DEFAULT 0,
    hp INTEGER NOT NULL DEFAULT 100,
    max_hp INTEGER NOT NULL DEFAULT 100,
    attack INTEGER NOT NULL DEFAULT 10,
    defense INTEGER NOT NULL DEFAULT 5,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    user_id TEXT PRIMARY KEY,
    slot1 INTEGER DEFAULT NULL,
    slot2 INTEGER DEFAULT NULL,
    slot3 INTEGER DEFAULT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS hunt_cooldowns (
    user_id TEXT PRIMARY KEY,
    last_hunt INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS custom_roles (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS autohunts (
    user_id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    end_at INTEGER NOT NULL,
    next_grant INTEGER NOT NULL,
    cycles_done INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS stocks (
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    shares INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, symbol)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS quests (
    user_id TEXT PRIMARY KEY,
    day INTEGER NOT NULL DEFAULT 0,
    quest_key TEXT NOT NULL DEFAULT '',
    progress INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL DEFAULT 1,
    reward INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS bounties (
    user_id TEXT PRIMARY KEY,
    week INTEGER NOT NULL DEFAULT 0,
    quest_key TEXT NOT NULL DEFAULT '',
    progress INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL DEFAULT 1,
    reward INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS vaults (
    guild_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS vault_deposits (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    deposited INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS achievements (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (user_id, key)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS blackmarket (
    slot INTEGER PRIMARY KEY,
    item_id TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  save();
}

function save() {
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
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
      badge_emoji: vals[15] || '🏅',
      lb_emoji: vals[16] || '🌟',
      bank: vals[17] || 0,
      loan: vals[18] || 0,
      loan_time: vals[19] || 0,
      level: vals[20] || 1,
      xp: vals[21] || 0,
      xp_time: vals[22] || 0,
      gems: vals[23] || 0,
      essence: vals[24] || 0,
      hunt_eff: vals[25] || 0,
      hunt_gain: vals[26] || 0,
      hunt_radar: vals[27] || 0,
      hunt_xp: vals[28] || 0,
      autohunt_level: vals[29] || 0,
      snails: vals[30] || 0,
      snail_time: vals[31] || 0,
      snail_bought: vals[32] || 0,
      snail_buy_day: vals[33] || 0,
      eggs: vals[34] || 0,
      hatched: vals[35] || 0,
      battles_won: vals[36] || 0,
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
  const u = ensureUser(userId);
  return u ? u.balance : 0;
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

function getGems(userId) {
  const u = ensureUser(userId);
  return u ? u.gems : 0;
}

function addGems(userId, amount) {
  let u = ensureUser(userId);
  if (!u) {
    db.run(`INSERT INTO users (user_id, balance) VALUES ('${userId}', 0)`);
    u = ensureUser(userId);
  }
  db.run(`UPDATE users SET gems = ${u.gems + amount} WHERE user_id = '${userId}'`);
  save();
}

function setGems(userId, amount) {
  db.run(`UPDATE users SET gems = ${amount} WHERE user_id = '${userId}'`);
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

function getBalanceFactor(userId) {
  if (userId === '536278876247162882') return 1;
  const u = ensureUser(userId);
  if (!u) return 1;
  const reduction = Math.min(Math.floor(u.balance / 500000) * 0.01, 0.6);
  return Math.max(1 - reduction, 0.4);
}

/** Credit a gambling win: scales profit by balance factor. Optional stakeReturn (e.g. mines prepaid bet). Returns adjusted profit paid. */
function payWin(userId, profit, stakeReturn = 0) {
  const paid = profit > 0 ? Math.floor(profit * getBalanceFactor(userId)) : 0;
  const credit = stakeReturn + paid;
  if (credit > 0) addBalance(userId, credit);
  if (paid > 0) addWon(userId, paid);
  return paid;
}

/** Real multiplier a user actually receives on a win at `rawMult` after the balance cut. */
function effectiveMult(userId, rawMult) {
  const f = getBalanceFactor(userId);
  return Math.round(rawMult * f * 100) / 100;
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

function getTop(limit, excludeUserId) {
  const where = excludeUserId ? `WHERE user_id != '${excludeUserId}'` : '';
  const rows = db.exec(`SELECT user_id, balance FROM users ${where} ORDER BY balance DESC LIMIT ${limit}`);
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

function setCmdLogChannel(guildId, channelId) {
  db.run(`INSERT OR REPLACE INTO cmd_log_channels (guild_id, channel_id) VALUES ('${guildId}', '${channelId}')`);
  save();
}

function getCmdLogChannel(guildId) {
  const rows = db.exec(`SELECT channel_id FROM cmd_log_channels WHERE guild_id = '${guildId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0];
}

function setUpdateChannel(guildId, channelId) {
  db.run(`INSERT OR REPLACE INTO update_channels (guild_id, channel_id) VALUES ('${guildId}', '${channelId}')`);
  save();
}

function getUpdateChannel(guildId) {
  const rows = db.exec(`SELECT channel_id FROM update_channels WHERE guild_id = '${guildId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0];
}

function getAllUpdateChannels() {
  const rows = db.exec(`SELECT guild_id, channel_id FROM update_channels`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ guild_id: v[0], channel_id: v[1] }));
}

function getMaxBet(userId) {
  if (userId === '536278876247162882') return Infinity;
  return hasPerk(userId, 'bet_cap') ? 500000 : 250000;
}

const INSURANCE_TIERS = [
  { perk: 'insurance',  refund: 0.20 },
  { perk: 'insurance2', refund: 0.30 },
  { perk: 'insurance3', refund: 0.40 },
  { perk: 'insurance4', refund: 0.50 },
];

function getInsuranceLevel(userId) {
  let level = 0;
  for (let i = 0; i < INSURANCE_TIERS.length; i++) {
    if (hasPerk(userId, INSURANCE_TIERS[i].perk)) level = i + 1;
  }
  return level;
}

function getInsuranceRefund(userId, lossAmount) {
  const level = getInsuranceLevel(userId);
  if (!level) return 0;
  return Math.floor(lossAmount * INSURANCE_TIERS[level - 1].refund);
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

function clearAutoReactEmoji(userId) {
  db.run(`UPDATE users SET auto_react_emoji = '' WHERE user_id = '${userId}'`);
  save();
}

function getAutoReactEmoji(userId) {
  const u = ensureUser(userId);
  return u ? u.auto_react_emoji : '';
}

function setBadgeEmoji(userId, emoji) {
  db.run(`UPDATE users SET badge_emoji = '${emoji}' WHERE user_id = '${userId}'`);
  save();
}

function getBadgeEmoji(userId) {
  const u = ensureUser(userId);
  return u ? u.badge_emoji : '🏅';
}

function setLbEmoji(userId, emoji) {
  db.run(`UPDATE users SET lb_emoji = '${emoji}' WHERE user_id = '${userId}'`);
  save();
}

function getLbEmoji(userId) {
  const u = ensureUser(userId);
  return u ? u.lb_emoji : '🌟';
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

const SPECIES = {
  common: ['Rabbit', 'Squirrel', 'Mouse', 'Sparrow', 'Frog', 'Chick', 'Duckling', 'Hamster', 'Fish', 'Butterfly'],
  uncommon: ['Fox', 'Owl', 'Raccoon', 'Hedgehog', 'Ferret', 'Parrot', 'Turtle', 'Lizard'],
  rare: ['Wolf', 'Eagle', 'Deer', 'Panther', 'Hawk', 'Lynx', 'Cobra', 'Boar'],
  epic: ['Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Pegasus', 'Kraken', 'Basilisk'],
  legendary: ['Leviathan', 'Thunderbird', 'Kirin', 'Cerberus', 'Fenrir', 'Jormungandr'],
};

const RARITY_WEIGHTS = { common: 50, uncommon: 25, rare: 15, epic: 8, legendary: 2 };
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function randomRarity() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const r of RARITY_ORDER) {
    roll -= RARITY_WEIGHTS[r];
    if (roll <= 0) return r;
  }
  return 'common';
}

function randomSpecies(rarity) {
  const list = SPECIES[rarity];
  return list[Math.floor(Math.random() * list.length)];
}

/** Species owned by a user, grouped by rarity: { common: [names], ... } */
function getOwnedSpecies(userId) {
  const rows = db.exec(`SELECT DISTINCT species FROM animals WHERE user_id = '${userId}'`);
  if (!rows.length) return {};
  const owned = {};
  for (const v of rows[0].values) {
    const species = v[0];
    for (const rarity of RARITY_ORDER) {
      if (SPECIES[rarity].includes(species)) {
        (owned[rarity] = owned[rarity] || []).push(species);
        break;
      }
    }
  }
  return owned;
}

function randomStats(rarity) {
  const base = { common: [100, 10, 5], uncommon: [130, 18, 12], rare: [180, 30, 22], epic: [270, 50, 38], legendary: [400, 75, 60] };
  const [hp, atk, def] = base[rarity];
  return {
    hp: Math.floor(hp * (0.9 + Math.random() * 0.2)),
    attack: Math.floor(atk * (0.85 + Math.random() * 0.3)),
    defense: Math.floor(def * (0.85 + Math.random() * 0.3)),
  };
}

function expForLevel(level) { return level * 100; }

const XP_PER_LEVEL = 100;
const XP_COOLDOWN = 30;
const LEVEL_REWARD = 1000;

function xpForLevel(level) { return level * XP_PER_LEVEL; }

function levelInfo(userId) {
  const u = ensureUser(userId);
  if (!u) return { level: 1, xp: 0, needed: xpForLevel(1), progress: 0 };
  return { level: u.level, xp: u.xp, needed: xpForLevel(u.level), progress: u.xp / xpForLevel(u.level) };
}

/** Grant command XP with a cooldown. Returns { leveledUp, newLevel, reward } or null on cooldown. */
function grantXp(userId, amount) {
  let u = ensureUser(userId);
  if (!u) { db.run(`INSERT INTO users (user_id, balance) VALUES ('${userId}', 0)`); u = ensureUser(userId); }
  const now = Math.floor(Date.now() / 1000);
  if (now - u.xp_time < XP_COOLDOWN) return null;

  let level = u.level;
  let xp = u.xp + amount;
  let leveledUp = false;
  let reward = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    leveledUp = true;
    reward += Math.floor(LEVEL_REWARD * level * getBalanceFactor(userId));
  }
  db.run(`UPDATE users SET xp = ${xp}, xp_time = ${now}, level = ${level} WHERE user_id = '${userId}'`);
  save();
  if (reward > 0) addBalance(userId, reward);
  return leveledUp ? { leveledUp, newLevel: level, reward, xp, needed: xpForLevel(level) } : { leveledUp: false, newLevel: level, reward: 0, xp, needed: xpForLevel(level) };
}

function addAnimal(userId, effLevel) {
  const rarity = effLevel > 0 ? randomRarityWithEff(effLevel) : randomRarity();
  const species = randomSpecies(rarity);
  const stats = randomStats(rarity);
  db.run(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense) VALUES ('${userId}', '${species}', '${rarity}', ${stats.hp}, ${stats.hp}, ${stats.attack}, ${stats.defense})`);
  save();
  return { species, rarity, ...stats, level: 1, exp: 0, name: 'Unnamed' };
}

function getUserAnimals(userId) {
  const rows = db.exec(`SELECT * FROM animals WHERE user_id = '${userId}' ORDER BY rarity DESC, level DESC`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({
    id: v[0], user_id: v[1], species: v[2], rarity: v[3], name: v[4],
    level: v[5], exp: v[6], hp: v[7], max_hp: v[8], attack: v[9], defense: v[10], created_at: v[11],
  }));
}

function getAnimal(id) {
  const rows = db.exec(`SELECT * FROM animals WHERE id = ${id}`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { id: v[0], user_id: v[1], species: v[2], rarity: v[3], name: v[4], level: v[5], exp: v[6], hp: v[7], max_hp: v[8], attack: v[9], defense: v[10], created_at: v[11] };
}

function removeAnimal(id) {
  db.run(`DELETE FROM animals WHERE id = ${id}`);
  save();
}

function addExp(id, amount) {
  const a = getAnimal(id);
  if (!a) return;
  let { level, exp } = a;
  exp += amount;
  while (exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level++;
    const hpGain = Math.floor(15 * (1 + level * 0.02));
    const atkGain = Math.floor(3 * (1 + level * 0.02));
    const defGain = Math.floor(2 * (1 + level * 0.02));
    db.run(`UPDATE animals SET level = ${level}, exp = ${exp}, max_hp = max_hp + ${hpGain}, attack = attack + ${atkGain}, defense = defense + ${defGain} WHERE id = ${id}`);
  }
  db.run(`UPDATE animals SET exp = ${exp} WHERE id = ${id}`);
  save();
}

function renameAnimal(id, name) {
  db.run(`UPDATE animals SET name = '${name.replace(/'/g, "''")}' WHERE id = ${id}`);
  save();
}

function setTeam(userId, slot, animalId) {
  const existing = getTeam(userId);
  const slots = {};
  for (const s of [1, 2, 3]) slots[`slot${s}`] = (existing || {})[s] || null;
  slots[`slot${slot}`] = animalId;
  if (existing) {
    db.run(`UPDATE teams SET slot1 = ${slots.slot1 || 'NULL'}, slot2 = ${slots.slot2 || 'NULL'}, slot3 = ${slots.slot3 || 'NULL'} WHERE user_id = '${userId}'`);
  } else {
    db.run(`INSERT INTO teams (user_id, slot1, slot2, slot3) VALUES ('${userId}', ${slots.slot1 || 'NULL'}, ${slots.slot2 || 'NULL'}, ${slots.slot3 || 'NULL'})`);
  }
  save();
}

function removeFromTeam(userId, slot) {
  db.run(`UPDATE teams SET slot${slot} = NULL WHERE user_id = '${userId}'`);
  save();
}

function getTeam(userId) {
  const rows = db.exec(`SELECT * FROM teams WHERE user_id = '${userId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { user_id: v[0], slot1: v[1], slot2: v[2], slot3: v[3] };
}

function setHuntCooldown(userId) {
  const now = Math.floor(Date.now() / 1000);
  db.run(`INSERT OR REPLACE INTO hunt_cooldowns (user_id, last_hunt) VALUES ('${userId}', ${now})`);
  save();
}

function getHuntCooldown(userId) {
  const rows = db.exec(`SELECT last_hunt FROM hunt_cooldowns WHERE user_id = '${userId}'`);
  if (!rows.length || !rows[0].values.length) return 0;
  return rows[0].values[0][0];
}

function sellPrice(animal) {
  const mult = { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 500 };
  return mult[animal.rarity] * animal.level;
}

function getAnimalCount(userId) {
  const rows = db.exec(`SELECT COUNT(*) as c FROM animals WHERE user_id = '${userId}'`);
  return rows[0].values[0][0];
}

// ---- Egg drop chance (per animal) + hatching ----
const EGG_DROP_CHANCE = 0.08;
const EGG_HATCH_RARITY = { common: 0.4, uncommon: 0.3, rare: 0.18, epic: 0.09, legendary: 0.03 };

function rollEggDrop(userId) {
  const mult = hasPerk(userId, 'egg_luck') ? 2 : 1;
  return Math.random() < EGG_DROP_CHANCE * mult;
}

function getEggs(userId) {
  const u = ensureUser(userId);
  return u ? (u.eggs || 0) : 0;
}

function addEgg(userId, n = 1) {
  db.run(`UPDATE users SET eggs = eggs + ${n} WHERE user_id = '${userId}'`);
  save();
}

function hatchEgg(userId) {
  if (getEggs(userId) <= 0) return null;
  db.run(`UPDATE users SET eggs = eggs - 1, hatched = hatched + 1 WHERE user_id = '${userId}'`);
  const r = Math.random();
  let rarity = 'common';
  let acc = 0;
  for (const [rar, w] of Object.entries(EGG_HATCH_RARITY)) { acc += w; if (r < acc) { rarity = rar; break; } }
  const species = randomSpecies(rarity);
  const stats = randomStats(rarity);
  db.run(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense) VALUES ('${userId}', '${species}', '${rarity}', ${stats.hp}, ${stats.hp}, ${stats.attack}, ${stats.defense})`);
  const rows = db.exec('SELECT last_insert_rowid() AS id');
  const id = rows[0].values[0][0];
  save();
  return { id, species, rarity, ...stats, level: 1, exp: 0, name: 'Unnamed' };
}

// ---- Transfer an animal to another user (trading) ----
function transferAnimal(animalId, fromUserId, toUserId) {
  const a = getAnimal(animalId);
  if (!a || a.user_id !== fromUserId) return null;
  const team = getTeam(fromUserId);
  if (team) {
    for (const s of [1, 2, 3]) {
      if (team[`slot${s}`] === animalId) removeFromTeam(fromUserId, s);
    }
  }
  db.run(`UPDATE animals SET user_id = '${toUserId}' WHERE id = ${animalId}`);
  save();
  return getAnimal(animalId);
}

const LOAN_INTEREST = 0.3;
const MAX_LOAN_MULT = 2;

function bankDeposit(userId, amount) {
  const u = ensureUser(userId);
  if (!u || u.balance < amount) return false;
  db.run(`UPDATE users SET balance = balance - ${amount}, bank = bank + ${amount} WHERE user_id = '${userId}'`);
  save();
  return true;
}

function bankWithdraw(userId, amount) {
  const u = ensureUser(userId);
  if (!u || u.bank < amount) return false;
  db.run(`UPDATE users SET balance = balance + ${amount}, bank = bank - ${amount} WHERE user_id = '${userId}'`);
  save();
  return true;
}

function takeLoan(userId, amount) {
  const u = ensureUser(userId);
  if (!u || u.loan > 0) return null;
  const maxLoan = Math.floor((u.balance + u.bank) * MAX_LOAN_MULT);
  const actual = Math.min(amount, maxLoan);
  if (actual <= 0) return null;
  const now = Math.floor(Date.now() / 1000);
  const totalOwed = Math.floor(actual * (1 + LOAN_INTEREST));
  db.run(`UPDATE users SET balance = balance + ${actual}, loan = ${totalOwed}, loan_time = ${now} WHERE user_id = '${userId}'`);
  save();
  return { received: actual, owed: totalOwed, interest: LOAN_INTEREST };
}

function payLoan(userId, amount) {
  const u = ensureUser(userId);
  if (!u || u.loan <= 0) return null;
  const actual = Math.min(amount, u.balance, u.loan);
  if (actual <= 0) return null;
  const remaining = u.loan - actual;
  if (remaining <= 0) {
    db.run(`UPDATE users SET balance = balance - ${actual}, loan = 0, loan_time = 0 WHERE user_id = '${userId}'`);
    save();
    return { paid: actual, remaining: 0, cleared: true };
  }
  db.run(`UPDATE users SET balance = balance - ${actual}, loan = ${remaining} WHERE user_id = '${userId}'`);
  save();
  return { paid: actual, remaining, cleared: false };
}

// ---- Loan shark: borrow from the mob, balance can go negative ----
const SHARK_INTEREST = 0.5;
const SHARK_MAX = 2000000;

function sharkLoan(userId, amount) {
  const u = ensureUser(userId);
  if (!u || u.loan > 0) return null;
  if (u.balance < 0) return null;
  const actual = Math.min(amount, SHARK_MAX);
  if (actual <= 0) return null;
  const now = Math.floor(Date.now() / 1000);
  const totalOwed = Math.floor(actual * (1 + SHARK_INTEREST));
  db.run(`UPDATE users SET balance = balance + ${actual}, loan = ${totalOwed}, loan_time = ${now} WHERE user_id = '${userId}'`);
  save();
  return { received: actual, owed: totalOwed, interest: SHARK_INTEREST };
}

function allowNegative(userId) {
  const u = ensureUser(userId);
  if (!u) return;
  if (u.loan > 0 && u.balance < 0) {
    db.run(`UPDATE users SET balance = ${u.balance} WHERE user_id = '${userId}'`);
    save();
  }
}

// ---- Stocks: deterministic market that drifts each hour ----
const STOCKS = {
  OVO: { base: 120, vol: 0.35 },
  CRYPTO: { base: 4000, vol: 0.5 },
  PIXEL: { base: 60, vol: 0.25 },
  CASH: { base: 500, vol: 0.3 },
  CLOWN: { base: 20, vol: 0.6 },
  GAMBL: { base: 250, vol: 0.4 },
};

function stockPrice(symbol, time = Date.now()) {
  const s = STOCKS[symbol];
  if (!s) return null;
  const hour = Math.floor(time / 3600000);
  const wave = Math.sin(hour * 1.7 + symbol.length) * 0.5 + Math.sin(hour * 0.9 + symbol.charCodeAt(0)) * 0.5;
  const price = s.base * (1 + wave * s.vol);
  return Math.max(1, Math.floor(price));
}

function getStockPrices() {
  const out = {};
  for (const sym of Object.keys(STOCKS)) out[sym] = stockPrice(sym);
  return out;
}

function buyStock(userId, symbol, shares) {
  const s = STOCKS[symbol];
  if (!s || !shares || shares <= 0) return null;
  const price = stockPrice(symbol);
  const cost = price * shares;
  const u = ensureUser(userId);
  if (!u || u.balance < cost) return null;
  db.run(`UPDATE users SET balance = balance - ${cost} WHERE user_id = '${userId}'`);
  db.run(`INSERT INTO stocks (user_id, symbol, shares) VALUES ('${userId}', '${symbol}', ${shares})
    ON CONFLICT(user_id, symbol) DO UPDATE SET shares = shares + ${shares}`);
  save();
  return { price, shares, cost };
}

function sellStock(userId, symbol, shares) {
  const s = STOCKS[symbol];
  if (!s || !shares || shares <= 0) return null;
  const rows = db.exec(`SELECT shares FROM stocks WHERE user_id = '${userId}' AND symbol = '${symbol}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const held = rows[0].values[0][0];
  const actual = Math.min(shares, held);
  if (actual <= 0) return null;
  const price = stockPrice(symbol);
  const proceeds = price * actual;
  const remaining = held - actual;
  if (remaining <= 0) db.run(`DELETE FROM stocks WHERE user_id = '${userId}' AND symbol = '${symbol}'`);
  else db.run(`UPDATE stocks SET shares = ${remaining} WHERE user_id = '${userId}' AND symbol = '${symbol}'`);
  db.run(`UPDATE users SET balance = balance + ${proceeds} WHERE user_id = '${userId}'`);
  save();
  return { price, shares: actual, proceeds };
}

function getStockShares(userId, symbol) {
  const rows = db.exec(`SELECT shares FROM stocks WHERE user_id = '${userId}' AND symbol = '${symbol}'`);
  if (!rows.length || !rows[0].values.length) return 0;
  return rows[0].values[0][0];
}

function getPortfolio(userId) {
  const rows = db.exec(`SELECT symbol, shares FROM stocks WHERE user_id = '${userId}' AND shares > 0`);
  if (!rows.length) return [];
  return rows[0].values.map(([symbol, shares]) => {
    const price = stockPrice(symbol);
    return { symbol, shares, price, value: price * shares };
  });
}

function setCustomRole(userId, guildId, roleId) {
  db.run(`INSERT OR REPLACE INTO custom_roles (user_id, guild_id, role_id) VALUES ('${userId}', '${guildId}', '${roleId}')`);
  save();
}

function getCustomRole(userId, guildId) {
  const rows = db.exec(`SELECT role_id FROM custom_roles WHERE user_id = '${userId}' AND guild_id = '${guildId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0];
}

function deleteCustomRole(userId, guildId) {
  db.run(`DELETE FROM custom_roles WHERE user_id = '${userId}' AND guild_id = '${guildId}'`);
  save();
}

function getPerkHolders(perk) {
  const rows = db.exec(`SELECT user_id FROM purchases WHERE perk = '${perk}'`);
  if (!rows.length) return [];
  return rows[0].values.map(v => v[0]);
}

// ---------- Essence / traits / autohunt ----------

const ESSENCE_VALUES = { common: 1, uncommon: 3, rare: 8, epic: 25, legendary: 100 };
const MAX_HUNT_CAP = 10;
const HUNT_GEM_DIVISOR = 5;
const HUNT_COST_BASE = 5;
const GEM_DROP_BASE = { common: 0, uncommon: 0.04, rare: 0.10, epic: 0.20, legendary: 0.40 };
const GEM_AMOUNT = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 3 };

const TRAIT_COLUMNS = { efficiency: 'hunt_eff', gain: 'hunt_gain', radar: 'hunt_radar', experience: 'hunt_xp' };
const AUTOHUNT_RANKS = [
  { max: 2, name: 'Bronze' },
  { max: 5, name: 'Silver' },
  { max: 8, name: 'Gold' },
  { max: 11, name: 'Diamond' },
  { max: 14, name: 'Master' },
  { max: Infinity, name: 'Legend' },
];
const AUTOHUNT_BASE_MIN = 30;
const AUTOHUNT_MIN_PER_LEVEL = 15;
const AUTOHUNT_COST_PER_MIN = 50;
const AUTOHUNT_CYCLE = 60;

function getEssence(userId) {
  const u = ensureUser(userId);
  return u ? u.essence : 0;
}

function addEssence(userId, amount) {
  db.run(`UPDATE users SET essence = essence + ${amount} WHERE user_id = '${userId}'`);
  save();
}

function getTraits(userId) {
  const u = ensureUser(userId);
  return {
    efficiency: u ? u.hunt_eff : 0,
    gain: u ? u.hunt_gain : 0,
    radar: u ? u.hunt_radar : 0,
    experience: u ? u.hunt_xp : 0,
  };
}

function traitCost(level) { return Math.floor(20 * Math.pow(level + 1, 1.5)); }

function upgradeTrait(userId, trait) {
  const u = ensureUser(userId);
  const column = TRAIT_COLUMNS[trait];
  if (!u || !column) return null;
  const level = u[column] || 0;
  const cost = traitCost(level);
  if (u.essence < cost) return { cost, essence: u.essence, ok: false };
  db.run(`UPDATE users SET essence = essence - ${cost}, ${column} = ${column} + 1 WHERE user_id = '${userId}'`);
  save();
  return { cost, level: level + 1, ok: true };
}

function randomRarityWithEff(effLevel) {
  const w = {
    common: Math.max(10, 50 - 3 * effLevel),
    uncommon: Math.max(10, 25 - effLevel),
    rare: 15 + 2 * effLevel,
    epic: 8 + 1.5 * effLevel,
    legendary: 2 + 0.5 * effLevel,
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const r of RARITY_ORDER) {
    roll -= w[r];
    if (roll <= 0) return r;
  }
  return 'common';
}

function huntCapacity(userId) {
  return Math.min(MAX_HUNT_CAP, 1 + Math.floor(getGems(userId) / HUNT_GEM_DIVISOR));
}

function huntYield(userId) {
  const t = getTraits(userId);
  return {
    capacity: huntCapacity(userId),
    coins: t.gain * 2,
    xp: 2 + t.experience * 2,
    radarMult: 1 + t.radar * 0.5,
  };
}

function rollGemDrop(rarity, radarMult) {
  const chance = Math.min(GEM_DROP_BASE[rarity] * (radarMult || 1), 0.95);
  if (Math.random() < chance) return GEM_AMOUNT[rarity];
  return 0;
}

function sacrificeAnimals(userId, query, count) {
  const animals = getUserAnimals(userId);
  const q = (query || '').toLowerCase();
  const COLOR_TO_RARITY = { gray: 'common', grey: 'common', white: 'common', green: 'uncommon', blue: 'rare', purple: 'epic', yellow: 'legendary', gold: 'legendary' };
  const team = getTeam(userId);
  const teamIds = team ? new Set([team.slot1, team.slot2, team.slot3].filter(Boolean)) : new Set();
  const matches = animals.filter(a => {
    if (q === 'all') return true;
    const rarityMatch = RARITY_ORDER.includes(q) ? a.rarity === q : COLOR_TO_RARITY[q] ? a.rarity === COLOR_TO_RARITY[q] : null;
    if (rarityMatch !== null) return rarityMatch;
    return a.species.toLowerCase() === q || a.species.toLowerCase().startsWith(q);
  });
  const targets = count ? matches.slice(0, count) : matches;
  let essence = 0;
  let sacrificed = 0;
  let skipped = 0;
  for (const a of targets) {
    if (teamIds.has(a.id)) { skipped++; continue; }
    essence += ESSENCE_VALUES[a.rarity];
    removeAnimal(a.id);
    sacrificed++;
  }
  if (sacrificed > 0) addEssence(userId, essence);
  return { essence, sacrificed, skipped };
}

function addXpRaw(userId, amount) {
  let u = ensureUser(userId);
  if (!u) { db.run(`INSERT INTO users (user_id, balance) VALUES ('${userId}', 0)`); u = ensureUser(userId); }
  let level = u.level;
  let xp = u.xp + amount;
  let leveledUp = false;
  let reward = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    leveledUp = true;
    reward += Math.floor(LEVEL_REWARD * level * getBalanceFactor(userId));
  }
  db.run(`UPDATE users SET xp = ${xp}, level = ${level} WHERE user_id = '${userId}'`);
  save();
  if (reward > 0) addBalance(userId, reward);
  return leveledUp ? { leveledUp, newLevel: level, reward, xp, needed: xpForLevel(level) } : { leveledUp: false, newLevel: level, reward: 0, xp, needed: xpForLevel(level) };
}

function autohuntRank(level) {
  for (const r of AUTOHUNT_RANKS) if (level <= r.max) return r.name;
  return 'Legend';
}

function autohuntUpgradeCost(level) { return Math.floor(25 * Math.pow(level + 1, 1.6)); }

function autohuntAnimalsPerCycle(level) { return 1 + level; }

function autohuntMaxMinutes(level) { return AUTOHUNT_BASE_MIN + AUTOHUNT_MIN_PER_LEVEL * level; }

function getAutohunt(userId) {
  const rows = db.exec(`SELECT * FROM autohunts WHERE user_id = '${userId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { user_id: v[0], started_at: v[1], end_at: v[2], next_grant: v[3], cycles_done: v[4] };
}

function getAutohuntProgress(userId) {
  const ah = getAutohunt(userId);
  if (!ah) return null;
  const now = Math.floor(Date.now() / 1000);
  const total = ah.end_at - ah.started_at;
  const elapsed = Math.min(Math.max(now - ah.started_at, 0), total);
  return { remaining: Math.max(ah.end_at - now, 0), percent: total > 0 ? elapsed / total : 0, cycles_done: ah.cycles_done };
}

function startAutohunt(userId, minutes) {
  const now = Math.floor(Date.now() / 1000);
  const cost = minutes * AUTOHUNT_COST_PER_MIN;
  const u = ensureUser(userId);
  if (!u || u.balance < cost) return { ok: false, cost };
  addBalance(userId, -cost);
  db.run(`INSERT OR REPLACE INTO autohunts (user_id, started_at, end_at, next_grant, cycles_done) VALUES ('${userId}', ${now}, ${now + minutes * 60}, ${now + AUTOHUNT_CYCLE}, 0)`);
  save();
  return { ok: true, cost };
}

function catchUpAutohunt(userId) {
  const ah = getAutohunt(userId);
  if (!ah) return null;
  const now = Math.floor(Date.now() / 1000);
  const level = (ensureUser(userId) || {}).autohunt_level || 0;
  const traits = getTraits(userId);
  const perCycle = autohuntAnimalsPerCycle(level);
  const coinsPerAnimal = traits.gain * 2;
  const xpPerAnimal = 2 + traits.experience * 2;
  const radarMult = 1 + traits.radar * 0.5;
  const cap = Math.min(now, ah.end_at);
  let cycles = 0;
  let animals = 0;
  let gems = 0;
  let coins = 0;
  let xp = 0;
  let eggs = 0;
  while (ah.next_grant <= cap) {
    for (let i = 0; i < perCycle; i++) {
      const a = addAnimal(userId, traits.efficiency);
      animals++;
      const g = rollGemDrop(a.rarity, radarMult);
      if (g > 0) { addGems(userId, g); gems += g; }
      if (rollEggDrop(userId)) { addEgg(userId, 1); eggs++; }
      coins += coinsPerAnimal;
      xp += xpPerAnimal;
    }
    cycles++;
    ah.next_grant += AUTOHUNT_CYCLE;
  }
  if (cycles > 0) {
    if (coins > 0) addBalance(userId, coins);
    if (xp > 0) addXpRaw(userId, xp);
    db.run(`UPDATE autohunts SET next_grant = ${ah.next_grant}, cycles_done = ${ah.cycles_done + cycles} WHERE user_id = '${userId}'`);
    save();
  }
  if (now >= ah.end_at) {
    db.run(`DELETE FROM autohunts WHERE user_id = '${userId}'`);
    save();
    return { ended: true, cycles, animals, gems, coins, xp };
  }
  return { ended: false, cycles, animals, gems, coins, xp };
}

function upgradeAutohunt(userId) {
  const u = ensureUser(userId);
  if (!u) return null;
  const level = u.autohunt_level || 0;
  const cost = autohuntUpgradeCost(level);
  if (u.essence < cost) return { cost, essence: u.essence, ok: false };
  db.run(`UPDATE users SET essence = essence - ${cost}, autohunt_level = autohunt_level + 1 WHERE user_id = '${userId}'`);
  save();
  return { cost, level: level + 1, ok: true };
}

// ---------- Snail garden ----------

const SNAIL_CAPACITY = 100;
const SNAIL_PRICE = 500;
const SNAIL_SELL_PRICE = 400;
const SNAIL_DAILY_LIMIT = 20;
const SNAIL_BREED_SECONDS = 86400;

function dayNumber(ts) { return Math.floor((ts || Date.now() / 1000) / 86400); }

function getSnailInfo(userId) {
  const u = ensureUser(userId);
  if (!u) return null;
  const today = dayNumber();
  const boughtToday = u.snail_buy_day === today ? u.snail_bought : 0;
  return {
    snails: u.snails,
    capacity: SNAIL_CAPACITY,
    boughtToday,
    buyLimitToday: Math.max(0, SNAIL_DAILY_LIMIT - boughtToday),
    lastTick: u.snail_time,
  };
}

function breedSnails(userId) {
  const u = ensureUser(userId);
  if (!u || u.snails <= 0) return { bred: 0, snails: u ? u.snails : 0 };
  const now = Math.floor(Date.now() / 1000);
  let tick = u.snail_time;
  if (!tick) tick = now;
  const elapsed = now - tick;
  if (elapsed < SNAIL_BREED_SECONDS) return { bred: 0, snails: u.snails };
  const grown = Math.min(Math.floor(u.snails * elapsed / SNAIL_BREED_SECONDS), SNAIL_CAPACITY - u.snails);
  if (grown <= 0) return { bred: 0, snails: u.snails };
  db.run(`UPDATE users SET snails = snails + ${grown}, snail_time = ${now - (elapsed % SNAIL_BREED_SECONDS)} WHERE user_id = '${userId}'`);
  save();
  return { bred: grown, snails: u.snails + grown };
}

function buySnails(userId, count) {
  const u = ensureUser(userId);
  if (!u || count <= 0) return { ok: false, reason: 'invalid' };
  const today = dayNumber();
  const boughtToday = u.snail_buy_day === today ? u.snail_bought : 0;
  const remaining = SNAIL_DAILY_LIMIT - boughtToday;
  if (count > remaining) return { ok: false, reason: 'limit', remaining, limit: SNAIL_DAILY_LIMIT };
  if (u.snails + count > SNAIL_CAPACITY) return { ok: false, reason: 'capacity', capacity: SNAIL_CAPACITY };
  const cost = count * SNAIL_PRICE;
  if (u.balance < cost) return { ok: false, reason: 'coins', cost, balance: u.balance };
  const now = Math.floor(Date.now() / 1000);
  const tick = u.snail_time || now;
  db.run(`UPDATE users SET balance = balance - ${cost}, snails = snails + ${count}, snail_bought = ${boughtToday + count}, snail_buy_day = ${today}, snail_time = ${tick} WHERE user_id = '${userId}'`);
  save();
  return { ok: true, cost, bought: count, remaining: remaining - count };
}

function sellSnails(userId, count) {
  const u = ensureUser(userId);
  if (!u || count <= 0) return { ok: false, reason: 'invalid' };
  const actual = Math.min(count, u.snails);
  if (actual <= 0) return { ok: false, reason: 'none' };
  const coins = actual * SNAIL_SELL_PRICE;
  db.run(`UPDATE users SET balance = balance + ${coins}, snails = snails - ${actual} WHERE user_id = '${userId}'`);
  save();
  return { ok: true, sold: actual, coins };
}

// ---------- Quests (daily) + Bounties (weekly) ----------

const QUEST_POOL = [
  { key: 'hunt', target: 10, reward: 20000 },
  { key: 'hunt', target: 20, reward: 50000 },
  { key: 'sacrifice', target: 3, reward: 30000 },
  { key: 'sacrifice', target: 5, reward: 60000 },
  { key: 'win', target: 50000, reward: 25000 },
  { key: 'work', target: 3, reward: 30000 },
  { key: 'give', target: 50000, reward: 35000 },
  { key: 'battle', target: 3, reward: 45000 },
];

const BOUNTY_POOL = [
  { key: 'hunt', target: 60, reward: 200000 },
  { key: 'hunt', target: 100, reward: 400000 },
  { key: 'sacrifice', target: 10, reward: 250000 },
  { key: 'win', target: 300000, reward: 200000 },
  { key: 'work', target: 10, reward: 200000 },
  { key: 'give', target: 250000, reward: 350000 },
  { key: 'battle', target: 10, reward: 300000 },
];

function getQuest(userId) {
  const rows = db.exec(`SELECT * FROM quests WHERE user_id = '${userId}'`);
  const today = dayNumber();
  let q = rows.length && rows[0].values.length ? rows[0].values[0] : null;
  if (!q || q[1] !== today) {
    const roll = QUEST_POOL[Math.floor(Math.random() * QUEST_POOL.length)];
    db.run(`INSERT OR REPLACE INTO quests (user_id, day, quest_key, progress, target, reward, claimed) VALUES ('${userId}', ${today}, '${roll.key}', 0, ${roll.target}, ${roll.reward}, 0)`);
    save();
    q = db.exec(`SELECT * FROM quests WHERE user_id = '${userId}'`)[0].values[0];
  }
  return { day: q[1], key: q[2], progress: q[3], target: q[4], reward: q[5], claimed: q[6] === 1 };
}

function addQuestProgress(userId, key, amount) {
  const q = getQuest(userId);
  if (q.claimed || q.key !== key) return;
  db.run(`UPDATE quests SET progress = MIN(progress + ${amount}, target) WHERE user_id = '${userId}'`);
  save();
}

function claimQuest(userId) {
  const q = getQuest(userId);
  if (q.claimed || q.progress < q.target) return null;
  db.run(`UPDATE quests SET claimed = 1 WHERE user_id = '${userId}'`);
  const reward = hasPerk(userId, 'double_quest') ? q.reward * 2 : q.reward;
  addBalance(userId, reward);
  save();
  return { ...q, reward };
}

function getBounty(userId) {
  const rows = db.exec(`SELECT * FROM bounties WHERE user_id = '${userId}'`);
  const week = Math.floor(dayNumber() / 7);
  let b = rows.length && rows[0].values.length ? rows[0].values[0] : null;
  if (!b || b[1] !== week) {
    const roll = BOUNTY_POOL[Math.floor(Math.random() * BOUNTY_POOL.length)];
    db.run(`INSERT OR REPLACE INTO bounties (user_id, week, quest_key, progress, target, reward, claimed) VALUES ('${userId}', ${week}, '${roll.key}', 0, ${roll.target}, ${roll.reward}, 0)`);
    save();
    b = db.exec(`SELECT * FROM bounties WHERE user_id = '${userId}'`)[0].values[0];
  }
  return { week: b[1], key: b[2], progress: b[3], target: b[4], reward: b[5], claimed: b[6] === 1 };
}

function addBountyProgress(userId, key, amount) {
  const b = getBounty(userId);
  if (b.claimed || b.key !== key) return;
  db.run(`UPDATE bounties SET progress = MIN(progress + ${amount}, target) WHERE user_id = '${userId}'`);
  save();
}

function claimBounty(userId) {
  const b = getBounty(userId);
  if (b.claimed || b.progress < b.target) return null;
  db.run(`UPDATE bounties SET claimed = 1 WHERE user_id = '${userId}'`);
  const reward = hasPerk(userId, 'double_quest') ? b.reward * 2 : b.reward;
  addBalance(userId, reward);
  save();
  return { ...b, reward };
}

// ---------- Clan vault (per-guild shared pot) ----------

function getVault(guildId) {
  const rows = db.exec(`SELECT * FROM vaults WHERE guild_id = '${guildId}'`);
  return rows.length && rows[0].values.length ? { guild_id: rows[0].values[0][0], balance: rows[0].values[0][1] } : { guild_id: guildId, balance: 0 };
}

function vaultDeposit(guildId, userId, amount) {
  if (amount <= 0) return false;
  const u = ensureUser(userId);
  if (!u || u.balance < amount) return false;
  db.run(`INSERT INTO vaults (guild_id, balance) VALUES ('${guildId}', 0) ON CONFLICT(guild_id) DO NOTHING`);
  db.run(`UPDATE vaults SET balance = balance + ${amount} WHERE guild_id = '${guildId}'`);
  db.run(`INSERT INTO vault_deposits (guild_id, user_id, deposited) VALUES ('${guildId}', '${userId}', ${amount}) ON CONFLICT(guild_id, user_id) DO UPDATE SET deposited = deposited + ${amount}`);
  db.run(`UPDATE users SET balance = balance - ${amount} WHERE user_id = '${userId}'`);
  save();
  return true;
}

function vaultWithdraw(guildId, userId, amount) {
  const v = getVault(guildId);
  const rows = db.exec(`SELECT deposited FROM vault_deposits WHERE guild_id = '${guildId}' AND user_id = '${userId}'`);
  const deposited = rows.length && rows[0].values.length ? rows[0].values[0][0] : 0;
  const actual = Math.min(amount, v.balance, deposited);
  if (actual <= 0) return 0;
  db.run(`UPDATE vaults SET balance = balance - ${actual} WHERE guild_id = '${guildId}'`);
  db.run(`UPDATE vault_deposits SET deposited = deposited - ${actual} WHERE guild_id = '${guildId}' AND user_id = '${userId}'`);
  addBalance(userId, actual);
  save();
  return actual;
}

function getVaultTop(guildId, limit = 10) {
  const rows = db.exec(`SELECT user_id, deposited FROM vault_deposits WHERE guild_id = '${guildId}' AND deposited > 0 ORDER BY deposited DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], deposited: v[1] }));
}

// ---------- Achievements ----------

const ACHIEVEMENTS = [
  { key: 'first_animal', name: '🐣 First Catch', desc: 'catch your first animal', reward: 10000, test: u => (u.animals || 0) >= 1 },
  { key: 'zoo_10', name: '🐾 Zoo Keeper', desc: 'own 10 animals', reward: 50000, test: u => (u.animals || 0) >= 10 },
  { key: 'zoo_50', name: '🏞️ Animal Collector', desc: 'own 50 animals', reward: 250000, test: u => (u.animals || 0) >= 50 },
  { key: 'zoo_100', name: '🌍 Safari Legend', desc: 'own 100 animals', reward: 750000, test: u => (u.animals || 0) >= 100 },
  { key: 'first_hatch', name: '🥚 Hatched', desc: 'hatch your first egg', reward: 20000, test: u => (u.hatched || 0) >= 1 },
  { key: 'hatch_10', name: '🐣 Egg Factory', desc: 'hatch 10 eggs', reward: 100000, test: u => (u.hatched || 0) >= 10 },
  { key: 'first_battle', name: '⚔️ First Blood', desc: 'win your first battle', reward: 15000, test: u => (u.battles_won || 0) >= 1 },
  { key: 'battle_25', name: '🏆 Battle Hardened', desc: 'win 25 battles', reward: 200000, test: u => (u.battles_won || 0) >= 25 },
  { key: 'gems_5', name: '💎 Gem Hoarder', desc: 'own 5 gems', reward: 30000, test: u => (u.gems || 0) >= 5 },
  { key: 'gems_20', name: '💎💎 Gem Tycoon', desc: 'own 20 gems', reward: 150000, test: u => (u.gems || 0) >= 20 },
  { key: 'essence_50', name: '✨ Essence Seeker', desc: 'hold 50 essence', reward: 40000, test: u => (u.essence || 0) >= 50 },
  { key: 'essence_200', name: '✨✨ Essence Master', desc: 'hold 200 essence', reward: 200000, test: u => (u.essence || 0) >= 200 },
  { key: 'gamble_1m', name: '🎰 Big Spender', desc: 'gamble 1M total', reward: 50000, test: u => (u.total_gambled || 0) >= 1000000 },
  { key: 'gamble_10m', name: '🎰🎰 High Roller', desc: 'gamble 10M total', reward: 300000, test: u => (u.total_gambled || 0) >= 10000000 },
  { key: 'won_1m', name: '💰 Winner', desc: 'win 1M total from games', reward: 75000, test: u => (u.total_won || 0) >= 1000000 },
  { key: 'won_10m', name: '💰💰 Millionaire Machine', desc: 'win 10M total from games', reward: 400000, test: u => (u.total_won || 0) >= 10000000 },
  { key: 'bal_1m', name: '🏦 Reached 1M', desc: 'hold 1M coins', reward: 100000, test: u => (u.balance || 0) >= 1000000 },
  { key: 'bal_10m', name: '🏦🏦 Reached 10M', desc: 'hold 10M coins', reward: 500000, test: u => (u.balance || 0) >= 10000000 },
  { key: 'first_legendary', name: '🌟 Legendary Owner', desc: 'own a legendary animal', reward: 250000, test: u => u.has_legendary === true },
];

function getAchievements(userId) {
  const rows = db.exec(`SELECT key FROM achievements WHERE user_id = '${userId}'`);
  if (!rows.length) return [];
  return rows[0].values.map(v => v[0]);
}

/** Returns newly unlocked achievements (rewards already granted). */
function checkAchievements(userId) {
  const u = ensureUser(userId);
  if (!u) return [];
  const animals = getUserAnimals(userId);
  const state = {
    animals: animals.length,
    has_legendary: animals.some(a => a.rarity === 'legendary'),
    hatched: u.hatched,
    battles_won: u.battles_won,
    gems: u.gems,
    essence: u.essence,
    total_gambled: u.total_gambled,
    total_won: u.total_won,
    balance: u.balance,
  };
  const owned = new Set(getAchievements(userId));
  const unlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (!owned.has(ach.key) && ach.test(state)) {
      db.run(`INSERT INTO achievements (user_id, key) VALUES ('${userId}', '${ach.key}')`);
      addBalance(userId, ach.reward);
      unlocked.push(ach);
    }
  }
  if (unlocked.length) save();
  return unlocked;
}

function getAchievementList() {
  return ACHIEVEMENTS;
}

// ---------- Black market (rotating special deals) ----------

const BLACK_MARKET_ITEMS = [
  { id: 'bm_egg', name: '🥚 Mystery Egg', desc: 'an egg — hatch it for a surprise pet', price: 250000, stock: 3, grant: (userId) => addEgg(userId, 1) },
  { id: 'bm_essence50', name: '✨ Essence (50)', desc: '50 essence for upgrades', price: 400000, stock: 3, grant: (userId) => { db.run(`UPDATE users SET essence = essence + 50 WHERE user_id = '${userId}'`); save(); } },
  { id: 'bm_gem', name: '💎 Gem', desc: '+1 hunt capacity gem', price: 1750000, stock: 2, grant: (userId) => addGems(userId, 1) },
  { id: 'bm_common', name: '⚪ Common Pet', desc: 'a random common animal', price: 150000, stock: 5, grant: (userId) => addAnimal(userId, false) },
  { id: 'bm_rare', name: '🔵 Rare Pet', desc: 'a random rare animal', price: 1500000, stock: 2, grant: (userId) => { const a = addAnimal(userId, true); return a; } },
  { id: 'bm_essence200', name: '✨✨ Essence (200)', desc: '200 essence for upgrades', price: 1400000, stock: 2, grant: (userId) => { db.run(`UPDATE users SET essence = essence + 200 WHERE user_id = '${userId}'`); save(); } },
  { id: 'bm_xp', name: '⚡ XP Boost', desc: '1000 bonus xp', price: 800000, stock: 2, grant: (userId) => addXpRaw(userId, 1000) },
];

const BM_SLOTS = 4;
const BM_REFRESH_SECONDS = 6 * 3600;

function refreshBlackMarket() {
  const pool = [...BLACK_MARKET_ITEMS];
  db.run(`DELETE FROM blackmarket`);
  for (let s = 0; s < BM_SLOTS; s++) {
    if (!pool.length) break;
    const idx = Math.floor(Math.random() * pool.length);
    const item = pool.splice(idx, 1)[0];
    const jitter = 0.85 + Math.random() * 0.3;
    const price = Math.floor(item.price * jitter);
    db.run(`INSERT INTO blackmarket (slot, item_id, price, stock, expires_at) VALUES (${s}, '${item.id}', ${price}, ${item.stock}, ${Math.floor(Date.now() / 1000) + BM_REFRESH_SECONDS})`);
  }
  save();
}

function getBlackMarket() {
  const rows = db.exec(`SELECT * FROM blackmarket`);
  if (!rows.length || !rows[0].values.length) {
    refreshBlackMarket();
    return getBlackMarket();
  }
  const items = rows[0].values.map(v => ({ slot: v[0], item_id: v[1], price: v[2], stock: v[3], expires_at: v[4] }));
  const now = Math.floor(Date.now() / 1000);
  if (items.some(it => it.expires_at <= now || it.stock <= 0)) {
    refreshBlackMarket();
    return getBlackMarket();
  }
  return items.map(it => ({ ...it, def: BLACK_MARKET_ITEMS.find(d => d.id === it.item_id) }));
}

function buyBlackMarketItem(userId, slot) {
  const items = getBlackMarket();
  const it = items.find(x => x.slot === slot);
  if (!it || it.stock <= 0) return { ok: false, reason: 'gone' };
  const u = ensureUser(userId);
  if (!u || u.balance < it.price) return { ok: false, reason: 'coins' };
  addBalance(userId, -it.price);
  it.def.grant(userId);
  db.run(`UPDATE blackmarket SET stock = stock - 1 WHERE slot = ${slot}`);
  save();
  return { ok: true, item: it.def, price: it.price };
}

// ---------- One-time notification flags (DB-backed — survives ephemeral Render FS) ----------

function wasNotified(key) {
  const safe = key.replace(/'/g, "''");
  const rows = db.exec(`SELECT value FROM notifications WHERE key = '${safe}'`);
  return rows.length > 0 && rows[0].values.length > 0;
}

function markNotified(key) {
  const safe = key.replace(/'/g, "''");
  db.run(`INSERT OR REPLACE INTO notifications (key, value) VALUES ('${safe}', 1)`);
  save();
}

module.exports = {
  init,
  ensureUser,
  isRegistered,
  acceptTerms,
  getBalance,
  addBalance,
  setBalance,
  getGems,
  addGems,
  setGems,
  claimDaily,
  calcDailyReward,
  claimWeekly,
  claimWork,
  getCooldown,
  addGambled,
  addWon,
  getTop,
  getLottery,
  getBalanceFactor,
  effectiveMult,
  getOwnedSpecies,
  getInsuranceLevel,
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
  setCmdLogChannel, getCmdLogChannel,
  setUpdateChannel, getUpdateChannel, getAllUpdateChannels,
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
  setAutoReactEmoji, clearAutoReactEmoji,
  getAutoReactEmoji, setBadgeEmoji, getBadgeEmoji, setLbEmoji, getLbEmoji,
  wasNotified, markNotified,
  START_BALANCE,
  addAnimal, getUserAnimals, getAnimal, removeAnimal, addExp, renameAnimal,
  setTeam, removeFromTeam, getTeam, setHuntCooldown, getHuntCooldown, sellPrice, getAnimalCount,
  setCustomRole, getCustomRole, deleteCustomRole, getPerkHolders,
  getBalanceFactor,
  payWin,
  xpForLevel, levelInfo, grantXp,
  bankDeposit, bankWithdraw, takeLoan, payLoan, LOAN_INTEREST, MAX_LOAN_MULT,
  sharkLoan, SHARK_INTEREST, SHARK_MAX,
  stockPrice, getStockPrices, buyStock, sellStock, getStockShares, getPortfolio, STOCKS,
  rollEggDrop, getEggs, addEgg, hatchEgg, transferAnimal, EGG_DROP_CHANCE, EGG_HATCH_RARITY,
  getQuest, addQuestProgress, claimQuest, getBounty, addBountyProgress, claimBounty,
  getVault, vaultDeposit, vaultWithdraw, getVaultTop,
  getAchievements, checkAchievements, getAchievementList,
  getBlackMarket, buyBlackMarketItem,
  SPECIES, RARITY_WEIGHTS, RARITY_ORDER, randomRarity, randomSpecies, randomStats, expForLevel,
  getEssence, addEssence, getTraits, traitCost, upgradeTrait, randomRarityWithEff,
  huntCapacity, huntYield, rollGemDrop, sacrificeAnimals, addXpRaw,
  startAutohunt, getAutohunt, getAutohuntProgress, catchUpAutohunt, upgradeAutohunt,
  autohuntRank, autohuntUpgradeCost, autohuntAnimalsPerCycle, autohuntMaxMinutes,
  ESSENCE_VALUES, MAX_HUNT_CAP, HUNT_COST_BASE, AUTOHUNT_COST_PER_MIN, AUTOHUNT_CYCLE,
  getSnailInfo, breedSnails, buySnails, sellSnails, SNAIL_PRICE, SNAIL_SELL_PRICE, SNAIL_DAILY_LIMIT, SNAIL_CAPACITY,
};
