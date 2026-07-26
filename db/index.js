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
  db.run(`CREATE TABLE IF NOT EXISTS marriages (user_id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, married_at INTEGER NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS adoption (parent_id TEXT, child_id TEXT, PRIMARY KEY (parent_id, child_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS purchases (user_id TEXT, perk TEXT, expires_at INTEGER, PRIMARY KEY (user_id, perk))`);
  db.run(`CREATE TABLE IF NOT EXISTS log_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
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
      badge_emoji: vals[15] || '🏅',
      lb_emoji: vals[16] || '🌟',
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

function getMaxBet(userId) {
  if (userId === '536278876247162882') return Infinity;
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

function addAnimal(userId) {
  const rarity = randomRarity();
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
  for (const s of [1, 2, 3]) slots[`slot${s}`] = existing[s] || null;
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
  getAutoReactEmoji, setBadgeEmoji, getBadgeEmoji, setLbEmoji, getLbEmoji,
  START_BALANCE,
  addAnimal, getUserAnimals, getAnimal, removeAnimal, addExp, renameAnimal,
  setTeam, removeFromTeam, getTeam, setHuntCooldown, getHuntCooldown, sellPrice, getAnimalCount,
  setCustomRole, getCustomRole, deleteCustomRole, getPerkHolders,
  SPECIES, RARITY_WEIGHTS, RARITY_ORDER, randomRarity, randomSpecies, randomStats, expForLevel,
};
