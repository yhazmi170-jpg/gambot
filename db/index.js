const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { parseAmount } = require('../utils/embed');

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
    CREATE TABLE IF NOT EXISTS channel_disabled (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      commands TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (guild_id, channel_id)
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
  try { db.run(`ALTER TABLE users ADD COLUMN loss_streak INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN last_loss_time INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN free_bet INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN free_bet_time INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN crate_pity INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN zoo_decor TEXT NOT NULL DEFAULT '[]'`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN seals INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN pray_streak INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN last_pray INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  db.run(`CREATE TABLE IF NOT EXISTS pet_achievements (animal_id INTEGER NOT NULL, key TEXT NOT NULL, at INTEGER NOT NULL DEFAULT (strftime('%s','now')), PRIMARY KEY (animal_id, key))`);
  db.run(`CREATE TABLE IF NOT EXISTS clans (clan_id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS clan_members (clan_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), PRIMARY KEY (clan_id, user_id))`);
  try { db.run(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_clan_member_user ON clan_members (user_id)`); } catch (e) {}
  db.run(`CREATE TABLE IF NOT EXISTS clan_wars (code TEXT PRIMARY KEY, attacker TEXT NOT NULL, defender TEXT NOT NULL, stake INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'challenge', winner TEXT, ends_at INTEGER NOT NULL, channel_id TEXT NOT NULL DEFAULT '', msg_id TEXT NOT NULL DEFAULT '')`);
  db.run(`CREATE TABLE IF NOT EXISTS clan_war_fighters (code TEXT NOT NULL, clan_id TEXT NOT NULL, user_id TEXT NOT NULL, power INTEGER NOT NULL, PRIMARY KEY (code, user_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS bids (auction_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL DEFAULT '', seller_id TEXT NOT NULL, animal_id INTEGER NOT NULL, min_bid INTEGER NOT NULL, current_bid INTEGER NOT NULL, current_bidder TEXT, ends_at INTEGER NOT NULL)`);
  try { db.run(`ALTER TABLE bids ADD COLUMN guild_id TEXT NOT NULL DEFAULT ''`); } catch (e) {}
  db.run(`CREATE TABLE IF NOT EXISTS world_boss (boss_id TEXT PRIMARY KEY, species TEXT NOT NULL, rarity TEXT NOT NULL, hp INTEGER NOT NULL, max_hp INTEGER NOT NULL, pot INTEGER NOT NULL DEFAULT 0, ends_at INTEGER NOT NULL)`);
  try { db.run(`ALTER TABLE world_boss ADD COLUMN level INTEGER NOT NULL DEFAULT 1`); } catch (e) {}
  db.run(`CREATE TABLE IF NOT EXISTS boss_contrib (boss_id TEXT NOT NULL, user_id TEXT NOT NULL, damage INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (boss_id, user_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS events (key TEXT PRIMARY KEY, type TEXT NOT NULL, ends_at INTEGER NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS plots (user_id TEXT PRIMARY KEY, level INTEGER NOT NULL DEFAULT 1, planted_at INTEGER NOT NULL DEFAULT 0, last_claim INTEGER NOT NULL DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS marriages (user_id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, married_at INTEGER NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS adoption (parent_id TEXT, child_id TEXT, PRIMARY KEY (parent_id, child_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS purchases (user_id TEXT, perk TEXT, expires_at INTEGER, PRIMARY KEY (user_id, perk))`);
  db.run(`CREATE TABLE IF NOT EXISTS log_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS cmd_log_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS update_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS event_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS merchant_state (id INTEGER PRIMARY KEY CHECK (id = 1), next_at INTEGER NOT NULL DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS merchant_stock (slot INTEGER PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, price INTEGER NOT NULL, sold_to TEXT, extra TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS pending_battles (
    id TEXT PRIMARY KEY,
    challenger_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    host_id TEXT NOT NULL,
    prize INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    entries TEXT NOT NULL DEFAULT '[]',
    winner_id TEXT DEFAULT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS streaks (user_id TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, last_time INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS pvp_bounties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poster_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    prize INTEGER NOT NULL,
    goal INTEGER NOT NULL,
    poster_wins INTEGER NOT NULL DEFAULT 0,
    target_wins INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    winner_id TEXT DEFAULT NULL,
    created_at INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS weekly_lb (user_id TEXT, week INTEGER, amount INTEGER NOT NULL DEFAULT 0, won INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, week))`);
  db.run(`CREATE TABLE IF NOT EXISTS lb_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS lb_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)`);
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
  try { db.run(`ALTER TABLE animals ADD COLUMN shiny INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE animals ADD COLUMN trait TEXT NOT NULL DEFAULT ''`); } catch (e) {}
  try { db.run(`ALTER TABLE animals ADD COLUMN fed_until INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
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
    color_a INTEGER,
    color_b INTEGER,
    PRIMARY KEY (user_id, guild_id)
  )`);
  try { db.run(`ALTER TABLE custom_roles ADD COLUMN color_a INTEGER`); } catch (e) {}
  try { db.run(`ALTER TABLE custom_roles ADD COLUMN color_b INTEGER`); } catch (e) {}
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
  // v1.8.0: clans became player-based (one clan per player, clan_id = owner's user id).
  // Wipe the old guild-scoped clan data once so no stale server-clans linger.
  if (!wasNotified('clan_v2_wipe')) {
    db.run(`DELETE FROM clans`);
    db.run(`DELETE FROM clan_members`);
    markNotified('clan_v2_wipe');
    save();
  }
  // v1.8.x: bet cap tiers above 2M were removed (5M/10M max bets broke the economy).
  // Refund holders of the removed tiers in full and promote them to the top remaining tier.
  if (!wasNotified('bet_cap_cleanup_v1')) {
    const removedTiers = { bet_cap_4: 20000000, bet_cap_5: 50000000 };
    const rows = db.exec(`SELECT user_id, perk FROM purchases WHERE perk = 'bet_cap_4' OR perk = 'bet_cap_5'`);
    if (rows.length && rows[0].values.length) {
      for (const [userId, perk] of rows[0].values) {
        const refund = removedTiers[perk] || 0;
        ensureUser(userId);
        db.run(`UPDATE users SET balance = balance + ${refund} WHERE user_id = '${userId}'`);
        removePerk(userId, perk);
        addPerk(userId, 'bet_cap_3', 0);
        console.log(`[migrate] refunded ${refund} to ${userId} for removed ${perk}, granted bet_cap_3`);
      }
    }
    markNotified('bet_cap_cleanup_v1');
    save();
  }
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
  db.run(`CREATE TABLE IF NOT EXISTS checklist_daily (
    user_id TEXT PRIMARY KEY,
    day INTEGER NOT NULL DEFAULT 0,
    eggs INTEGER NOT NULL DEFAULT 0,
    hunt INTEGER NOT NULL DEFAULT 0,
    battle INTEGER NOT NULL DEFAULT 0,
    gamble INTEGER NOT NULL DEFAULT 0,
    gems INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS checklist_weekly (
    user_id TEXT PRIMARY KEY,
    week INTEGER NOT NULL DEFAULT 0,
    hunt INTEGER NOT NULL DEFAULT 0,
    battle INTEGER NOT NULL DEFAULT 0,
    eggs INTEGER NOT NULL DEFAULT 0,
    gamble INTEGER NOT NULL DEFAULT 0,
    gems INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pass_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    season INTEGER NOT NULL DEFAULT 1,
    ends_at INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS battlepass (
    user_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    premium INTEGER NOT NULL DEFAULT 0,
    free_claimed TEXT NOT NULL DEFAULT '',
    prem_claimed TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, season)
  )`);
  try { db.run(`INSERT OR IGNORE INTO pass_state (id, season, ends_at) VALUES (1, 1, ${Math.floor(Date.now() / 1000) + 14 * 86400})`); } catch (e) {}
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
      balance: Number.isFinite(vals[1]) ? vals[1] : 0,
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
      loss_streak: vals[37] || 0,
      last_loss_time: vals[38] || 0,
      free_bet: vals[39] || 0,
      free_bet_time: vals[40] || 0,
      crate_pity: vals[41] || 0,
      zoo_decor: vals[42] || '[]',
      seals: vals[43] || 0,
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
  if (typeof amount !== 'number' || !Number.isFinite(amount)) { console.error(`addBalance: NaN/Inf guard for ${userId}, amount=${amount}`); return; }
  const newBal = Math.max(0, u.balance + amount);
  db.run(`UPDATE users SET balance = ${newBal} WHERE user_id = '${userId}'`);
  save();
}

function setBalance(userId, amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return;
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
  if (amount > 0) {
    addChecklistProgress(userId, 'daily', 'gems', amount);
    addChecklistProgress(userId, 'weekly', 'gems', amount);
  }
}

function setGems(userId, amount) {
  db.run(`UPDATE users SET gems = ${amount} WHERE user_id = '${userId}'`);
  save();
}

function getSeals(userId) {
  const u = ensureUser(userId);
  return u ? (u.seals || 0) : 0;
}

function addSeals(userId, amount) {
  let u = ensureUser(userId);
  if (!u) {
    db.run(`INSERT INTO users (user_id, balance) VALUES ('${userId}', 0)`);
    u = ensureUser(userId);
  }
  db.run(`UPDATE users SET seals = ${u.seals + amount} WHERE user_id = '${userId}'`);
  save();
  return u.seals + amount;
}

// Move ALL of a source account's data onto a destination account, overwriting the
// destination's data (dest is the old/new main; source is the banned/lost account).
// Uses UPDATE ... WHERE user_id='src' -> 'dest' so row ids / FKs (animals->teams) stay intact.
function mergeUser(srcId, destId) {
  if (!srcId || !destId || srcId === destId) throw new Error('mergeUser: invalid ids');

  // tables where user_id is the (or a) key — these must be re-pointed src -> dest
  const userTables = [
    ['users', 'user_id'],
    ['lottery', 'user_id'],
    ['purchases', 'user_id'],
    ['animals', 'user_id'],
    ['teams', 'user_id'],
    ['hunt_cooldowns', 'user_id'],
    ['custom_roles', 'user_id'],
    ['autohunts', 'user_id'],
    ['stocks', 'user_id'],
    ['quests', 'user_id'],
    ['bounties', 'user_id'],
    ['vault_deposits', 'user_id'],
    ['achievements', 'user_id'],
    ['marriages', 'user_id'],
  ];
  // tables referencing the user via a non-primary column (re-point those too)
  const refs = [
    ['marriages', 'partner_id'],
    ['adoption', 'parent_id'],
    ['adoption', 'child_id'],
    ['pending_battles', 'challenger_id'],
    ['pending_battles', 'target_id'],
  ];

  // 1) drop the destination's own rows ONLY in tables the source actually has rows in
  //    (so a table where src has nothing isn't wiped of dest data)
  for (const [t, c] of userTables) {
    try {
      const srcRows = db.exec(`SELECT COUNT(*) FROM ${t} WHERE ${c} = '${srcId}'`);
      const n = (srcRows[0] && srcRows[0].values[0][0]) || 0;
      if (n > 0) db.run(`DELETE FROM ${t} WHERE ${c} = '${destId}'`);
    } catch (e) {}
  }

  // 2) recommit the source's data as the destination (overwrite)
  for (const [t, c] of userTables) {
    try { db.run(`UPDATE ${t} SET ${c} = '${destId}' WHERE ${c} = '${srcId}'`); } catch (e) {}
  }

  // 3) re-point FK references that pointed at the source
  for (const [t, c] of refs) {
    try { db.run(`UPDATE ${t} SET ${c} = '${destId}' WHERE ${c} = '${srcId}'`); } catch (e) {}
  }

  save();
  return true;
}

// Full account wipe — removes the user from every user-scoped table, then deletes
// the users row. Next command recreates a fresh default row via ensureUser.
function wipeUser(userId) {
  if (!userId) return;
  // animal-linked cleanup first
  try { db.exec(`DELETE FROM pet_achievements WHERE animal_id IN (SELECT id FROM animals WHERE user_id = '${userId}')`); } catch (e) {}
  // tables keyed by user_id
  const userTables = [
    'animals', 'teams', 'hunt_cooldowns', 'custom_roles', 'autohunts',
    'stocks', 'quests', 'bounties', 'vault_deposits', 'achievements',
    'streaks', 'weekly_lb', 'lottery', 'purchases', 'plots',
    'checklist_daily', 'checklist_weekly', 'battlepass', 'boss_contrib',
    'clan_members', 'clan_war_fighters',
  ];
  for (const t of userTables) {
    try { db.run(`DELETE FROM ${t} WHERE user_id = '${userId}'`); } catch (e) {}
  }
  // bidirectional / foreign references
  try { db.run(`DELETE FROM marriages WHERE user_id = '${userId}' OR partner_id = '${userId}'`); } catch (e) {}
  try { db.run(`DELETE FROM adoption WHERE parent_id = '${userId}' OR child_id = '${userId}'`); } catch (e) {}
  try { db.run(`DELETE FROM pending_battles WHERE challenger_id = '${userId}' OR target_id = '${userId}'`); } catch (e) {}
  try { db.run(`DELETE FROM pvp_bounties WHERE poster_id = '${userId}' OR target_id = '${userId}'`); } catch (e) {}
  try { db.run(`DELETE FROM giveaways WHERE host_id = '${userId}'`); } catch (e) {}
  try { db.run(`DELETE FROM bids WHERE seller_id = '${userId}' OR current_bidder = '${userId}'`); } catch (e) {}
  // if they owned a clan, delete the clan too (members already cleared above)
  try { db.run(`DELETE FROM clans WHERE owner_id = '${userId}'`); } catch (e) {}
  // un-mark any merchant stock they bought
  try { db.run(`UPDATE merchant_stock SET sold_to = NULL WHERE sold_to = '${userId}'`); } catch (e) {}
  // notifications rows are keyed by string key, not user — skip
  // finally the user row itself
  try { db.run(`DELETE FROM users WHERE user_id = '${userId}'`); } catch (e) {}
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
  const mult = marriedMult(userId);
  const reward = Math.min(Math.floor((1000 + streak * 500) * mult), max);
  db.run(`UPDATE users SET daily_time = ${now}, daily_streak = ${streak}, balance = balance + ${reward} WHERE user_id = '${userId}'`);
  save();
  return { reward, streak, max, mult };
}

function claimWeekly(userId, amount) {
  const now = Math.floor(Date.now() / 1000);
  const mult = marriedMult(userId);
  const final = Math.floor(amount * mult);
  db.run(`UPDATE users SET weekly_time = ${now}, balance = balance + ${final} WHERE user_id = '${userId}'`);
  save();
  return { mult };
}

// ---- Logon streak: escalating daily bonus, resets after 48h without a claim ----
const STREAK_BASE = 5000;
const STREAK_MAX_DAY = 7;

function getStreak(userId) {
  const rows = db.exec(`SELECT count, last_time, best FROM streaks WHERE user_id = '${userId}'`);
  if (!rows.length || !rows[0].values.length) return { count: 0, last_time: 0, best: 0 };
  const v = rows[0].values[0];
  return { count: v[0], last_time: v[1], best: v[2] };
}

function claimStreak(userId) {
  const now = Math.floor(Date.now() / 1000);
  const s = getStreak(userId);
  if (s.last_time > 0 && now - s.last_time < 86400) return { cooldown: Math.floor(86400 - (now - s.last_time)) };
  const freeze = getActiveEvent() && EVENT_TYPES[getActiveEvent().key] && EVENT_TYPES[getActiveEvent().key].apply === 'streakFreeze';
  const grace = freeze ? 86400 * 4 : 86400 * 2;
  let count = 1;
  if (s.last_time > 0 && now - s.last_time < grace) count = s.count + 1;
  const reward = Math.floor(STREAK_BASE * Math.min(count, STREAK_MAX_DAY) * getBalanceFactor(userId));
  const best = Math.max(s.best, count);
  db.run(`INSERT OR REPLACE INTO streaks (user_id, count, last_time, best) VALUES ('${userId}', ${count}, ${now}, ${best})`);
  db.run(`UPDATE users SET balance = balance + ${reward} WHERE user_id = '${userId}'`);
  save();
  return { count, reward, best, cooldown: 0, maxDay: STREAK_MAX_DAY };
}

// ---- Pray: daily streak with tiny multiplier ----
const PRAY_BASE_MIN = 100;
const PRAY_BASE_MAX = 500;

function claimPray(userId) {
  const now = Math.floor(Date.now() / 1000);
  const user = ensureUser(userId);
  const lastPray = user.last_pray || 0;
  let streak = user.pray_streak || 0;
  const sameDay = lastPray > 0 && now - lastPray < 86400;
  const missed = lastPray > 0 && now - lastPray >= 86400 * 2;

  if (missed) streak = 0;
  if (!sameDay) streak += 1;

  const mult = 1 + streak * 0.01;
  const base = Math.floor(Math.random() * (PRAY_BASE_MAX - PRAY_BASE_MIN + 1)) + PRAY_BASE_MIN;
  const factor = getBalanceFactor(userId);
  const reward = Math.floor(base * mult * factor);
  const diff = reward - base;
  const paid = base + (diff > 0 ? diff : 0);

  db.run(`UPDATE users SET pray_streak = ${streak}, last_pray = ${now}, balance = balance + ${paid} WHERE user_id = '${userId}'`);
  save();
  return { streak, mult, reward: paid, base, factor };
}

function claimWork(userId, amount) {
  const now = Math.floor(Date.now() / 1000);
  const mult = marriedMult(userId);
  const final = Math.floor(amount * mult);
  db.run(`UPDATE users SET work_time = ${now}, balance = balance + ${final} WHERE user_id = '${userId}'`);
  save();
  return { mult };
}

function isMarried(userId) { return !!getMarriage(userId); }

function marriedMult(userId) {
  return isMarried(userId) ? 1.1 : 1;
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
  const rushMult = eventMult('winMult');
  const paid = profit > 0 ? Math.floor(profit * getBalanceFactor(userId) * rushMult) : 0;
  let credit = stakeReturn;
  if (paid > 0) {
    const u = ensureUser(userId);
    const loan = u && u.loan > 0 ? u.loan : 0;
    if (loan > 0) {
      const toLoan = Math.min(paid, loan);
      db.run(`UPDATE users SET loan = loan - ${toLoan} WHERE user_id = '${userId}'`);
      save();
      credit += paid - toLoan;
    } else {
      credit += paid;
    }
    addWon(userId, paid);
    resetLossStreak(userId);
  }
  if (credit > 0) addBalance(userId, credit);
  return paid;
}

/** Real multiplier a user actually receives on a win at `rawMult` after the balance cut.
 *  The cut applies to profit only (stake is returned in full), so a 1.3x win at factor 0.4
 *  pays 1 + 0.3*0.4 = 1.12x, NOT 0.52x. */
function effectiveMult(userId, rawMult) {
  const f = getBalanceFactor(userId);
  return Math.round((1 + (rawMult - 1) * f) * 100) / 100;
}

function getCooldown(lastTime, cooldownSec) {
  if (!lastTime) return 0;
  const elapsed = Date.now() / 1000 - lastTime;
  return Math.max(0, cooldownSec - elapsed);
}

function addGambled(userId, amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return;
  db.run(`UPDATE users SET total_gambled = total_gambled + ${amount} WHERE user_id = '${userId}'`);
  addWeeklyLb(userId, amount, 0);
  addChecklistProgress(userId, 'daily', 'gamble', amount);
  addChecklistProgress(userId, 'weekly', 'gamble', amount);
  addPassXp(userId, PASS_XP.gamble_per_1k ? Math.floor(amount / 1000) * PASS_XP.gamble_per_1k : 0);
  save();
}

function addWon(userId, amount) {
  db.run(`UPDATE users SET total_won = total_won + ${amount} WHERE user_id = '${userId}'`);
  addWeeklyLb(userId, 0, amount);
  addPassXp(userId, PASS_XP.win_per_10k ? Math.floor(amount / 10000) * PASS_XP.win_per_10k : 0);
  save();
}

// ---- v1.7.1: Weekly gambling leaderboard (auto-posted + rewarded) ----
const WEEKLY_LB_SECONDS = 604800;
const WEEKLY_LB_REWARDS = [1000000, 500000, 250000, 200000, 150000, 100000, 75000, 60000, 50000, 40000]; // top 10
const LB_OWNER_ID = '536278876247162882';

function currentLbWeek() {
  return Math.floor(Date.now() / 1000 / WEEKLY_LB_SECONDS);
}

function addWeeklyLb(userId, amountDelta, wonDelta) {
  if (!amountDelta && !wonDelta) return;
  if (userId === LB_OWNER_ID) return; // owner stays hidden from the board
  const week = currentLbWeek();
  const rows = db.exec(`SELECT amount, won FROM weekly_lb WHERE user_id = '${userId}' AND week = ${week}`);
  if (rows.length && rows[0].values.length) {
    const [amt, won] = rows[0].values[0];
    db.run(`UPDATE weekly_lb SET amount = ${amt + amountDelta}, won = ${won + wonDelta} WHERE user_id = '${userId}' AND week = ${week}`);
  } else {
    db.run(`INSERT INTO weekly_lb (user_id, week, amount, won) VALUES ('${userId}', ${week}, ${amountDelta}, ${wonDelta})`);
  }
  save();
}

function getWeeklyLb(week) {
  const rows = db.exec(`SELECT user_id, amount, won FROM weekly_lb WHERE week = ${week} ORDER BY (won - amount) DESC, won DESC LIMIT 20`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], amount: v[1], won: v[2], net: v[2] - v[1] }));
}

function getLbState(key) {
  const rows = db.exec(`SELECT value FROM lb_state WHERE key = '${key}'`);
  return (rows.length && rows[0].values.length) ? rows[0].values[0][0] : null;
}

function setLbState(key, value) {
  db.run(`INSERT OR REPLACE INTO lb_state (key, value) VALUES ('${key}', '${value}')`);
  save();
}

// Finalizes a completed week: pays top-3, returns standings for the announcement.
function finalizeWeeklyLb(week) {
  const list = getWeeklyLb(week).filter(x => x.user_id !== LB_OWNER_ID);
  const paid = [];
  for (let i = 0; i < WEEKLY_LB_REWARDS.length && i < list.length; i++) {
    addBalance(list[i].user_id, WEEKLY_LB_REWARDS[i]);
    paid.push({ user_id: list[i].user_id, amount: list[i].amount, reward: WEEKLY_LB_REWARDS[i], place: i + 1 });
  }
  return { week, list, paid, rewards: WEEKLY_LB_REWARDS };
}

// ---- Leaderboard channel: Aovo lb #channel ----
function setLbChannel(guildId, channelId) {
  if (!channelId) {
    db.run(`DELETE FROM lb_channels WHERE guild_id = '${guildId}'`);
  } else {
    db.run(`INSERT OR REPLACE INTO lb_channels (guild_id, channel_id) VALUES ('${guildId}', '${channelId}')`);
  }
  save();
}

function getAllLbChannels() {
  const rows = db.exec(`SELECT guild_id, channel_id FROM lb_channels`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ guild_id: v[0], channel_id: v[1] }));
}

function addBattleWin(userId) {
  const u = ensureUser(userId);
  if (!u) return 0;
  const wins = (u.battles_won || 0) + 1;
  db.run(`UPDATE users SET battles_won = ${wins} WHERE user_id = '${userId}'`);
  save();
  return wins;
}

function getBattleWins(userId) {
  const u = ensureUser(userId);
  return u ? (u.battles_won || 0) : 0;
}

function getTop(limit, excludeUserId) {
  const where = excludeUserId ? `WHERE user_id != '${excludeUserId}'` : '';
  const rows = db.exec(`SELECT user_id, balance + COALESCE(bank, 0) as total FROM users ${where} ORDER BY total DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], balance: v[1] }));
}

function getGamblers(limit) {
  const rows = db.exec(`SELECT user_id, total_gambled FROM users WHERE total_gambled > 0 ORDER BY total_gambled DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], total_gambled: v[1] }));
}

function getAllUsers() {
  const rows = db.exec('SELECT user_id, balance, bank, total_gambled FROM users');
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], balance: v[1], bank: v[2], total_gambled: v[3] }));
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

function isCommandDisabled(guildId, cmdName, channelId) {
  if (!guildId) return false;
  const guild = getGuild(guildId);
  if (guild.disabled_commands.includes('all') || guild.disabled_commands.includes(cmdName)) return true;
  if (!channelId) return false;
  const rows = db.exec(`SELECT commands FROM channel_disabled WHERE guild_id = '${guildId}' AND channel_id = '${channelId}'`);
  if (!rows.length || !rows[0].values.length) return false;
  const list = JSON.parse(rows[0].values[0][0] || '[]');
  return list.includes('all') || list.includes(cmdName);
}

function disableChannelCommand(guildId, channelId, cmdName) {
  if (!guildId || !channelId) return;
  const rows = db.exec(`SELECT commands FROM channel_disabled WHERE guild_id = '${guildId}' AND channel_id = '${channelId}'`);
  let list = [];
  if (rows.length && rows[0].values.length) list = JSON.parse(rows[0].values[0][0] || '[]');
  if (cmdName === 'all') {
    list = ['all'];
  } else if (!list.includes(cmdName) && !list.includes('all')) {
    list.push(cmdName);
  }
  db.run(`INSERT OR REPLACE INTO channel_disabled (guild_id, channel_id, commands) VALUES ('${guildId}', '${channelId}', '${JSON.stringify(list)}')`);
  save();
}

function enableChannelCommand(guildId, channelId, cmdName) {
  if (!guildId || !channelId) return;
  const rows = db.exec(`SELECT commands FROM channel_disabled WHERE guild_id = '${guildId}' AND channel_id = '${channelId}'`);
  if (!rows.length || !rows[0].values.length) return;
  let list = JSON.parse(rows[0].values[0][0] || '[]');
  list = list.filter(c => c !== cmdName && c !== 'all');
  if (list.length === 0) {
    db.run(`DELETE FROM channel_disabled WHERE guild_id = '${guildId}' AND channel_id = '${channelId}'`);
  } else {
    db.run(`UPDATE channel_disabled SET commands = '${JSON.stringify(list)}' WHERE guild_id = '${guildId}' AND channel_id = '${channelId}'`);
  }
  save();
}

function getChannelDisabled(guildId, channelId) {
  const rows = db.exec(`SELECT commands FROM channel_disabled WHERE guild_id = '${guildId}' AND channel_id = '${channelId}'`);
  if (!rows.length || !rows[0].values.length) return [];
  return JSON.parse(rows[0].values[0][0] || '[]');
}

// ---- Pending battles: persisted so requests survive bot restarts/deploys ----
function setPendingBattle(id, challengerId, targetId, expiresAt) {
  db.run(`INSERT OR REPLACE INTO pending_battles (id, challenger_id, target_id, expires_at) VALUES ('${id}', '${challengerId}', '${targetId}', ${expiresAt})`);
  save();
}

function getPendingBattle(id) {
  const rows = db.exec(`SELECT challenger_id, target_id, expires_at FROM pending_battles WHERE id = '${id}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { challenger_id: v[0], target_id: v[1], expires_at: v[2] };
}

function deletePendingBattle(id) {
  db.run(`DELETE FROM pending_battles WHERE id = '${id}'`);
  save();
}

function cleanupPendingBattles() {
  db.run(`DELETE FROM pending_battles WHERE expires_at < ${Math.floor(Date.now() / 1000)}`);
  save();
}

function repairNaNBalances() {
  try {
    const rows = db.exec(`SELECT user_id, balance FROM users WHERE balance != balance`);
    if (rows.length && rows[0].values.length) {
      for (const v of rows[0].values) {
        console.error(`repairNaNBalances: fixing NaN balance for ${v[0]} (was ${v[1]})`);
        db.run(`UPDATE users SET balance = 0 WHERE user_id = '${v[0]}'`);
      }
      save();
      console.log(`repairNaNBalances: fixed ${rows[0].values.length} NaN balance(s)`);
    }
  } catch (e) { console.error('repairNaNBalances error:', e.message); }
}

// ---- Giveaways: persisted so a restart never kills an "about to end" giveaway ----
function createGiveaway(messageId, channelId, hostId, prize, endsAt) {
  db.run(`INSERT OR REPLACE INTO giveaways (message_id, channel_id, host_id, prize, ends_at, entries, winner_id) VALUES ('${messageId}', '${channelId}', '${hostId}', ${prize}, ${endsAt}, '[]', NULL)`);
  save();
}

function getGiveaway(messageId) {
  const rows = db.exec(`SELECT message_id, channel_id, host_id, prize, ends_at, entries, winner_id FROM giveaways WHERE message_id = '${messageId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  let entries = [];
  try { entries = JSON.parse(v[5] || '[]'); } catch {}
  return { message_id: v[0], channel_id: v[1], host_id: v[2], prize: v[3], ends_at: v[4], entries, winner_id: v[6] };
}

function addGiveawayEntry(messageId, userId) {
  const g = getGiveaway(messageId);
  if (!g) return false;
  if (!g.entries.includes(userId)) {
    g.entries.push(userId);
    db.run(`UPDATE giveaways SET entries = '${JSON.stringify(g.entries).replace(/'/g, "''")}' WHERE message_id = '${messageId}'`);
    save();
  }
  return true;
}

// IDs of giveaways that have expired but haven't drawn a winner yet (done: winner_id set)
function getExpiredGiveaways(now) {
  const rows = db.exec(`SELECT message_id FROM giveaways WHERE ends_at <= ${now} AND winner_id IS NULL`);
  if (!rows.length) return [];
  return rows[0].values.map(r => r[0]);
}

function finishGiveaway(messageId, winnerId) {
  db.run(`UPDATE giveaways SET winner_id = '${winnerId}' WHERE message_id = '${messageId}'`);
  save();
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

function setEventChannel(guildId, channelId) {
  if (!channelId) {
    db.run(`DELETE FROM event_channels WHERE guild_id = '${guildId}'`);
  } else {
    db.run(`INSERT OR REPLACE INTO event_channels (guild_id, channel_id) VALUES ('${guildId}', '${channelId}')`);
  }
  save();
}

function getEventChannel(guildId) {
  const rows = db.exec(`SELECT channel_id FROM event_channels WHERE guild_id = '${guildId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0];
}

function getAllEventChannels() {
  const rows = db.exec(`SELECT guild_id, channel_id FROM event_channels`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ guild_id: v[0], channel_id: v[1] }));
}

function ownerCheck(userId) { return userId === '536278876247162882'; }

function getMaxBet(userId) {
  if (ownerCheck(userId)) return Infinity;
  if (hasPerk(userId, 'bet_cap')) return 500000;
  return 250000;
}

// Bet parsing with max-bet enforcement on EVERY bet path (explicit amounts AND
// `all`). Numeric bets used to bypass getMaxBet entirely — the shop bet-cap
// perks are now real for all bets, not just `all`.
function parseBet(userId, input) {
  if ((input || '').toLowerCase() === 'all') {
    const u = ensureUser(userId);
    const amount = Math.min(u.balance, getMaxBet(userId));
    if (amount <= 0) return { error: 'you have no money' };
    return { amount };
  }
  const amount = parseAmount(input);
  if (isNaN(amount) || amount <= 0) return { error: 'bet an amount or use `all`' };
  const maxBet = getMaxBet(userId);
  if (amount > maxBet) return { error: `max bet is ${maxBet.toLocaleString()} — upgrade with bet cap perks in the shop` };
  return { amount };
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
  const base = level ? Math.floor(lossAmount * INSURANCE_TIERS[level - 1].refund) : 0;
  const streak = registerLoss(userId);
  const bonus = Math.floor(lossAmount * lossStreakBonus(streak));
  return base + bonus;
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
  common: ['Rabbit', 'Squirrel', 'Mouse', 'Sparrow', 'Frog', 'Chick', 'Duckling', 'Hamster', 'Fish', 'Butterfly', 'Otter', 'Penguin', 'Koala', 'Sloth', 'Capybara'],
  uncommon: ['Fox', 'Owl', 'Raccoon', 'Hedgehog', 'Ferret', 'Parrot', 'Turtle', 'Lizard', 'Guinea Pig', 'Skunk', 'Wallaby', 'Puffin'],
  rare: ['Wolf', 'Eagle', 'Deer', 'Panther', 'Hawk', 'Lynx', 'Cobra', 'Boar', 'Jaguar', 'Grizzly', 'Moose', 'Hippo'],
  epic: ['Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Pegasus', 'Kraken', 'Basilisk', 'Manticore', 'Sphinx', 'Roc', 'Wyvern'],
  legendary: ['Leviathan', 'Thunderbird', 'Kirin', 'Cerberus', 'Fenrir', 'Jormungandr'],
  mythic: ['Odin', 'Tiamat', 'Bahamut', 'Cthulhu', 'Godzilla'],
};

const RARITY_WEIGHTS = { common: 50, uncommon: 25, rare: 15, epic: 8, legendary: 2, mythic: 0.2 };
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

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
  const base = { common: [100, 10, 5], uncommon: [130, 18, 12], rare: [180, 30, 22], epic: [270, 50, 38], legendary: [400, 75, 60], mythic: [650, 130, 100] };
  const [hp, atk, def] = base[rarity];
  return {
    hp: Math.floor(hp * (0.9 + Math.random() * 0.2)),
    attack: Math.floor(atk * (0.85 + Math.random() * 0.3)),
    defense: Math.floor(def * (0.85 + Math.random() * 0.3)),
  };
}

const SHINY_CHANCE = 1 / 200;
const PERSONALITIES = ['Brave', 'Chill', 'Eager', 'Lucky', 'Calm'];

function rollShiny() { return Math.random() < SHINY_CHANCE; }
function rollTrait() { return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)]; }

function expForLevel(level) { return level * 100; }

const XP_PER_LEVEL = 100;
const XP_COOLDOWN = 30;
const LEVEL_REWARD = 1000;

// ---------- Battle pass (seasonal progression) ----------
const PASS_DURATION = 14 * 86400; // a season lasts 14 days
const PASS_MAX_LEVEL = 25;
const PASS_PREM_COST = 25; // seals to unlock premium track
const PASS_XP = { hunt: 2, battle: 3, hatch: 4, sacrifice: 1, give: 2, work: 3, gamble_per_1k: 1, win_per_10k: 1, quest: 15, bounty: 30, checklist_daily: 10, checklist_weekly: 25 };
function passXpForLevel(level) { return level * 150; }

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
  const shiny = rollShiny() ? 1 : 0;
  const trait = rollTrait();
  db.run(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense, shiny, trait) VALUES ('${userId}', '${species}', '${rarity}', ${stats.hp}, ${stats.hp}, ${stats.attack}, ${stats.defense}, ${shiny}, '${trait}')`);
  const rows = db.exec('SELECT last_insert_rowid() AS id');
  const id = rows[0].values[0][0];
  save();
  if (shiny) awardPetAchievement(id, 'shiny');
  if (rarity === 'mythic') awardPetAchievement(id, 'mythic');
  return { id, species, rarity, ...stats, level: 1, exp: 0, name: 'Unnamed', shiny: shiny === 1, trait };
}

function getUserAnimals(userId) {
  const rows = db.exec(`SELECT * FROM animals WHERE user_id = '${userId}' ORDER BY rarity DESC, level DESC`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({
    id: v[0], user_id: v[1], species: v[2], rarity: v[3], name: v[4],
    level: v[5], exp: v[6], hp: v[7], max_hp: v[8], attack: v[9], defense: v[10], created_at: v[11],
    shiny: v[12] === 1, trait: v[13] || '', fed_until: v[14] || 0,
  }));
}

function getAnimal(id) {
  const rows = db.exec(`SELECT * FROM animals WHERE id = ${id}`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { id: v[0], user_id: v[1], species: v[2], rarity: v[3], name: v[4], level: v[5], exp: v[6], hp: v[7], max_hp: v[8], attack: v[9], defense: v[10], created_at: v[11], shiny: v[12] === 1, trait: v[13] || '', fed_until: v[14] || 0 };
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
  if (level > a.level) {
    if (a.level < 10 && level >= 10) awardPetAchievement(id, 'level_10');
    if (a.level < 25 && level >= 25) awardPetAchievement(id, 'level_25');
    if (a.level < 50 && level >= 50) awardPetAchievement(id, 'level_50');
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
  for (const s of [1, 2, 3]) slots[`slot${s}`] = existing ? existing[`slot${s}`] : null;
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
  const mult = { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 500, mythic: 1500 };
  const shinyMult = animal.shiny ? 2 : 1;
  return mult[animal.rarity] * animal.level * shinyMult;
}

function getAnimalCount(userId) {
  const rows = db.exec(`SELECT COUNT(*) as c FROM animals WHERE user_id = '${userId}'`);
  return rows[0].values[0][0];
}

// ---- Egg drop chance (per animal) + hatching ----
const EGG_DROP_CHANCE = 0.08;
const EGG_HATCH_RARITY = { common: 0.38, uncommon: 0.29, rare: 0.18, epic: 0.1, legendary: 0.04, mythic: 0.01 };

function rollEggDrop(userId) {
  const mult = hasPerk(userId, 'egg_luck') ? 2 : 1;
  return Math.random() < EGG_DROP_CHANCE * mult * eventMult('eggMult');
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
  const shiny = rollShiny() ? 1 : 0;
  const trait = rollTrait();
  db.run(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense, shiny, trait) VALUES ('${userId}', '${species}', '${rarity}', ${stats.hp}, ${stats.hp}, ${stats.attack}, ${stats.defense}, ${shiny}, '${trait}')`);
  const rows = db.exec('SELECT last_insert_rowid() AS id');
  const id = rows[0].values[0][0];
  save();
  if (shiny) awardPetAchievement(id, 'shiny');
  if (rarity === 'mythic') awardPetAchievement(id, 'mythic');
  return { id, species, rarity, ...stats, level: 1, exp: 0, name: 'Unnamed', shiny: shiny === 1, trait };
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
  const tax = Math.floor(amount * 0.05); // 5% withdrawal tax
  const received = amount - tax;
  db.run(`UPDATE users SET balance = balance + ${received}, bank = bank - ${amount} WHERE user_id = '${userId}'`);
  save();
  return { received, tax };
}

function adminBankRemove(userId, amount) {
  const u = ensureUser(userId);
  if (!u || !u.bank) return;
  const actual = Math.min(amount, u.bank);
  db.run(`UPDATE users SET bank = bank - ${actual} WHERE user_id = '${userId}'`);
  save();
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

function getLoan(userId) {
  const u = ensureUser(userId);
  return u ? u.loan : 0;
}

function hasOutstandingLoan(userId) {
  return getLoan(userId) > 0;
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

function setCustomRoleColor(userId, guildId, colorA, colorB) {
  db.run(`UPDATE custom_roles SET color_a = ${colorA === null ? 'NULL' : colorA}, color_b = ${colorB === null ? 'NULL' : colorB} WHERE user_id = '${userId}' AND guild_id = '${guildId}'`);
  save();
}

function getGradientCustomRoles() {
  const rows = db.exec(`SELECT user_id, guild_id, role_id, color_a, color_b FROM custom_roles WHERE color_a IS NOT NULL AND color_b IS NOT NULL AND color_a IS NOT color_b`);
  if (!rows.length || !rows[0].values.length) return [];
  return rows[0].values.map(v => ({ userId: v[0], guildId: v[1], roleId: v[2], colorA: v[3], colorB: v[4] }));
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

const ESSENCE_VALUES = { common: 1, uncommon: 3, rare: 8, epic: 25, legendary: 100, mythic: 500 };
const MAX_HUNT_CAP = 10;
const HUNT_GEM_DIVISOR = 5;
const HUNT_COST_BASE = 5;
const GEM_DROP_BASE = { common: 0.50, uncommon: 0.70, rare: 0.85, epic: 0.95, legendary: 1.0, mythic: 1.0 };
const GEM_AMOUNT = { common: 3, uncommon: 5, rare: 8, epic: 12, legendary: 20, mythic: 50 };

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
  const cost = Math.max(1, Math.floor(traitCost(level) * eventMult('traitMult')));
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
  const base = 1 + Math.floor(getGems(userId) / HUNT_GEM_DIVISOR);
  const ev = getActiveEvent();
  const bonus = ev && EVENT_TYPES[ev.key] && EVENT_TYPES[ev.key].apply === 'huntCapMult' ? EVENT_TYPES[ev.key].mult : 0;
  return Math.min(MAX_HUNT_CAP + bonus, base + bonus);
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
  const r = (rarity || '').toLowerCase();
  const chance = Math.min((GEM_DROP_BASE[r] || 0) * (radarMult || 1) * eventMult('gemMult'), 0.95);
  if (Math.random() < chance) return (GEM_AMOUNT[r] || 0) * eventMult('gemMult');
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
  const surgeMult = eventMult('essenceMult');
  for (const a of targets) {
    if (teamIds.has(a.id)) { skipped++; continue; }
    let val = ESSENCE_VALUES[a.rarity];
    if (a.shiny) val *= 2;
    essence += Math.floor(val * surgeMult);
    removeAnimal(a.id);
    sacrificed++;
  }
  if (sacrificed > 0) addEssence(userId, essence);
  return { essence, sacrificed, skipped, surgeMult, shinyCount: targets.filter(a => a.shiny && !teamIds.has(a.id)).length };
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
  const perCycle = autohuntAnimalsPerCycle(level) + Math.round(eventMult('autohuntMult')) - 1;
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
  addPassXp(userId, PASS_XP.quest);
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
  addPassXp(userId, PASS_XP.bounty);
  save();
  return { ...b, reward };
}

// ---------- Multi-task checklists (daily + weekly) ----------
const CHECKLIST_COLUMNS = ['eggs', 'hunt', 'battle', 'gamble', 'gems'];
const CHECKLIST_DEFS = {
  daily: {
    table: 'checklist_daily',
    period: 'day',
    tasks: { hunt: 10, battle: 5, eggs: 5, gamble: 100000, gems: 10 },
    reward: 50000,
    seals: 1,
  },
  weekly: {
    table: 'checklist_weekly',
    period: 'week',
    tasks: { hunt: 100, battle: 50, eggs: 100, gamble: 1000000, gems: 100 },
    reward: 300000,
    seals: 3,
  },
};

function checklistPeriodNumber(period) {
  return period === 'weekly' ? Math.floor(dayNumber() / 7) : dayNumber();
}

function checklistRow(userId, period, ensure) {
  const def = CHECKLIST_DEFS[period];
  const num = checklistPeriodNumber(period);
  const select = `SELECT user_id, ${def.period}, eggs, hunt, battle, gamble, gems, claimed FROM ${def.table}`;
  let rows = db.exec(`${select} WHERE user_id = '${userId}'`);
  const raw = rows.length && rows[0].values.length ? rows[0].values[0] : null;
  if (raw && raw[1] === num) return raw;
  if (raw && raw[1] !== num && ensure) {
    db.run(`DELETE FROM ${def.table} WHERE user_id = '${userId}' AND ${def.period} <> ${num}`);
    save();
  }
  if (ensure) {
    db.run(`INSERT OR REPLACE INTO ${def.table} (user_id, ${def.period}) VALUES ('${userId}', ${num})`);
    save();
    rows = db.exec(`${select} WHERE user_id = '${userId}'`);
    return rows[0].values[0];
  }
  return null;
}

function getChecklist(userId, period) {
  const def = CHECKLIST_DEFS[period];
  const raw = checklistRow(userId, period, true);
  let progress = {};
  for (const k of CHECKLIST_COLUMNS) progress[k] = raw[progressIdx(k)] || 0;
  const allDone = CHECKLIST_COLUMNS.every(k => progress[k] >= (def.tasks[k] || 0));
  return { period, periodNum: raw[1], tasks: def.tasks, progress, allDone, claimed: raw[7] === 1, reward: def.reward, seals: def.seals };
}

function progressIdx(key) {
  return { eggs: 2, hunt: 3, battle: 4, gamble: 5, gems: 6 }[key];
}

function addChecklistProgress(userId, period, key, amount) {
  if (!CHECKLIST_DEFS[period] || !CHECKLIST_COLUMNS.includes(key)) return;
  const raw = checklistRow(userId, period, true);
  if (raw[7] === 1) return; // already claimed this period
  const def = CHECKLIST_DEFS[period];
  const target = def.tasks[key];
  db.run(`UPDATE ${def.table} SET ${key} = MIN(${key} + ${amount}, ${target}) WHERE user_id = '${userId}'`);
  save();
}

function claimChecklist(userId, period) {
  const c = getChecklist(userId, period);
  if (c.claimed || !c.allDone) return null;
  db.run(`UPDATE ${CHECKLIST_DEFS[period].table} SET claimed = 1 WHERE user_id = '${userId}'`);
  addBalance(userId, c.reward);
  addSeals(userId, c.seals);
  addPassXp(userId, period === 'weekly' ? PASS_XP.checklist_weekly : PASS_XP.checklist_daily);
  save();
  return { ...c, claimed: true };
}

// ---------- Battle pass (seasonal progression + reward tracks) ----------
function currentSeason() {
  const rows = db.exec(`SELECT season, ends_at FROM pass_state WHERE id = 1`);
  const now = Math.floor(Date.now() / 1000);
  if (!rows.length || !rows[0].values.length) {
    const ends = now + PASS_DURATION;
    db.run(`INSERT OR REPLACE INTO pass_state (id, season, ends_at) VALUES (1, 1, ${ends})`);
    save();
    return { season: 1, endsAt: ends };
  }
  let [season, endsAt] = rows[0].values[0];
  if (now >= endsAt) {
    season += 1;
    endsAt = now + PASS_DURATION;
    db.run(`UPDATE pass_state SET season = ${season}, ends_at = ${endsAt} WHERE id = 1`);
    save();
  }
  return { season, endsAt };
}

function passRow(userId, season, ensure) {
  let rows = db.exec(`SELECT user_id, season, xp, premium, free_claimed, prem_claimed FROM battlepass WHERE user_id = '${userId}' AND season = ${season}`);
  if (rows.length && rows[0].values.length) return rows[0].values[0];
  if (ensure) {
    db.run(`INSERT OR REPLACE INTO battlepass (user_id, season, xp, premium, free_claimed, prem_claimed) VALUES ('${userId}', ${season}, 0, 0, '', '')`);
    save();
    rows = db.exec(`SELECT user_id, season, xp, premium, free_claimed, prem_claimed FROM battlepass WHERE user_id = '${userId}' AND season = ${season}`);
    return rows[0].values[0];
  }
  return null;
}

function passLevel(xp) {
  let level = 0;
  let remaining = xp;
  while (level < PASS_MAX_LEVEL && remaining >= passXpForLevel(level + 1)) {
    remaining -= passXpForLevel(level + 1);
    level++;
  }
  return { level, into: remaining, need: level >= PASS_MAX_LEVEL ? 0 : passXpForLevel(level + 1) };
}

function passProgress(userId) {
  const { season, endsAt } = currentSeason();
  const raw = passRow(userId, season, true);
  const xp = raw[2];
  const premium = raw[3] === 1;
  const freeClaimed = (raw[4] || '').split(',').filter(Boolean).map(Number);
  const premClaimed = (raw[5] || '').split(',').filter(Boolean).map(Number);
  const { level, into, need } = passLevel(xp);
  return { season, endsAt, xp, premium, level, maxLevel: PASS_MAX_LEVEL, into, need, freeClaimed, premClaimed };
}

function addPassXp(userId, amount) {
  if (!amount || amount <= 0) return passProgress(userId);
  const boosted = Math.floor(amount * eventMult('passXpMult'));
  const { season } = currentSeason();
  const raw = passRow(userId, season, true);
  const newXp = raw[2] + boosted;
  db.run(`UPDATE battlepass SET xp = ${newXp} WHERE user_id = '${userId}' AND season = ${season}`);
  save();
  return passProgress(userId);
}

function buyPassPremium(userId) {
  const { season } = currentSeason();
  const raw = passRow(userId, season, true);
  if (raw[3] === 1) return { ok: false, reason: 'owned' };
  const seals = getSeals(userId);
  if (seals < PASS_PREM_COST) return { ok: false, reason: 'seals' };
  addSeals(userId, -PASS_PREM_COST);
  db.run(`UPDATE battlepass SET premium = 1 WHERE user_id = '${userId}' AND season = ${season}`);
  save();
  return { ok: true };
}

function passReward(level, premium) {
  // returns { coins, gems, seals } for unlocking `level` on a track
  const coins = premium ? 12000 * level : 4000 * level;
  const gems = premium ? level * 2 : 0;
  const seals = premium && level % 5 === 0 ? 1 : 0;
  return { coins, gems, seals };
}

function claimPassLevel(userId, level, track) {
  const { season } = currentSeason();
  const raw = passRow(userId, season, true);
  const { level: curLevel } = passLevel(raw[2]);
  if (level > curLevel) return { ok: false, reason: 'locked' };
  if (track === 'premium' && raw[3] !== 1) return { ok: false, reason: 'no_premium' };
  const claimed = track === 'premium' ? (raw[5] || '').split(',').filter(Boolean).map(Number) : (raw[4] || '').split(',').filter(Boolean).map(Number);
  if (claimed.includes(level)) return { ok: false, reason: 'claimed' };
  claimed.push(level);
  const col = track === 'premium' ? 'prem_claimed' : 'free_claimed';
  db.run(`UPDATE battlepass SET ${col} = '${claimed.join(',')}' WHERE user_id = '${userId}' AND season = ${season}`);
  const r = passReward(level, track === 'premium');
  if (r.coins) addBalance(userId, r.coins);
  if (r.gems) addGems(userId, r.gems);
  if (r.seals) addSeals(userId, r.seals);
  save();
  return { ok: true, reward: r };
}

function claimAllPass(userId) {
  const prog = passProgress(userId);
  const claimed = [];
  for (let lvl = 1; lvl <= prog.level; lvl++) {
    if (!prog.freeClaimed.includes(lvl)) {
      const r = claimPassLevel(userId, lvl, 'free');
      if (r.ok) claimed.push({ level: lvl, track: 'free', ...r.reward });
    }
    if (prog.premium && !prog.premClaimed.includes(lvl)) {
      const r = claimPassLevel(userId, lvl, 'premium');
      if (r.ok) claimed.push({ level: lvl, track: 'premium', ...r.reward });
    }
  }
  return claimed;
}

function passTop(limit = 10) {
  const { season } = currentSeason();
  const rows = db.exec(`SELECT user_id, xp FROM battlepass WHERE season = ${season} ORDER BY xp DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ userId: v[0], xp: v[1], ...passLevel(v[1]) }));
}

// ---- v1.7.x: Player-funded PvP bounties ----
// Poster funds a prize; first player to reach `goal` duel wins vs the other takes the pot.
const PVP_BOUNTY_LIFETIME = 7 * 86400;

function createPvpBounty(posterId, targetId, goal, prize) {
  const u = ensureUser(posterId);
  if (!u || (u.balance || 0) < prize) return { ok: false, reason: 'coins' };
  const rows = db.exec(`SELECT id FROM pvp_bounties WHERE status = 'active' AND ((poster_id = '${posterId}' AND target_id = '${targetId}') OR (poster_id = '${targetId}' AND target_id = '${posterId}')) LIMIT 1`);
  if (rows.length && rows[0].values.length) return { ok: false, reason: 'existing' };
  addBalance(posterId, -prize);
  db.run(`INSERT INTO pvp_bounties (poster_id, target_id, prize, goal, poster_wins, target_wins, status, created_at) VALUES ('${posterId}', '${targetId}', ${prize}, ${goal}, 0, 0, 'active', ${Math.floor(Date.now() / 1000)})`);
  save();
  const id = db.exec(`SELECT id FROM pvp_bounties WHERE poster_id = '${posterId}' AND target_id = '${targetId}' AND status = 'active' ORDER BY id DESC LIMIT 1`)[0].values[0][0];
  return { ok: true, id };
}

function getPvpBounty(id) {
  const rows = db.exec(`SELECT id, poster_id, target_id, prize, goal, poster_wins, target_wins, status, winner_id FROM pvp_bounties WHERE id = ${id}`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { id: v[0], poster_id: v[1], target_id: v[2], prize: v[3], goal: v[4], poster_wins: v[5], target_wins: v[6], status: v[7], winner_id: v[8] };
}

function listActiveBounties() {
  const rows = db.exec(`SELECT id, poster_id, target_id, prize, goal, poster_wins, target_wins FROM pvp_bounties WHERE status = 'active' ORDER BY id DESC`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ id: v[0], poster_id: v[1], target_id: v[2], prize: v[3], goal: v[4], poster_wins: v[5], target_wins: v[6] }));
}

function getPvpBountyBetween(a, b) {
  const rows = db.exec(`SELECT id FROM pvp_bounties WHERE status = 'active' AND ((poster_id = '${a}' AND target_id = '${b}') OR (poster_id = '${b}' AND target_id = '${a}')) LIMIT 1`);
  if (!rows.length || !rows[0].values.length) return null;
  return getPvpBounty(rows[0].values[0][0]);
}

// Called after every duel between a & b; `winnerId` is the duel winner.
// Returns null if no active bounty, or the updated bounty + whether the pot was won.
function recordPvpDuelWin(a, b, winnerId) {
  const bounty = getPvpBountyBetween(a, b);
  if (!bounty) return null;
  const isPoster = winnerId === bounty.poster_id;
  const col = isPoster ? 'poster_wins' : 'target_wins';
  const wins = (isPoster ? bounty.poster_wins : bounty.target_wins) + 1;
  if (wins >= bounty.goal) {
    addBalance(winnerId, bounty.prize);
    db.run(`UPDATE pvp_bounties SET status = 'done', winner_id = '${winnerId}', ${col} = ${wins} WHERE id = ${bounty.id}`);
    save();
    return { bounty: { ...bounty, poster_wins: isPoster ? wins : bounty.poster_wins, target_wins: isPoster ? bounty.target_wins : wins }, won: true, winnerId };
  }
  db.run(`UPDATE pvp_bounties SET ${col} = ${wins} WHERE id = ${bounty.id}`);
  save();
  return { bounty: { ...bounty, poster_wins: isPoster ? wins : bounty.poster_wins, target_wins: isPoster ? bounty.target_wins : wins }, won: false, winnerId, wins, goal: bounty.goal };
}

function cancelPvpBounty(userId, id) {
  const b = getPvpBounty(id);
  if (!b || b.status !== 'active') return { ok: false, reason: 'notfound' };
  if (b.poster_id !== userId) return { ok: false, reason: 'notowner' };
  if (b.poster_wins > 0 || b.target_wins > 0) return { ok: false, reason: 'started' };
  addBalance(userId, b.prize);
  db.run(`UPDATE pvp_bounties SET status = 'cancelled' WHERE id = ${id}`);
  save();
  return { ok: true };
}

function pruneExpiredBounties() {
  const now = Math.floor(Date.now() / 1000);
  const rows = db.exec(`SELECT id, poster_id, prize FROM pvp_bounties WHERE status = 'active' AND created_at + ${PVP_BOUNTY_LIFETIME} < ${now}`);
  if (!rows.length || !rows[0].values.length) return 0;
  let refunded = 0;
  for (const [id, poster, prize] of rows[0].values) {
    const b = getPvpBounty(id);
    if (b && b.poster_wins === 0 && b.target_wins === 0) {
      addBalance(poster, prize);
      refunded += prize;
    }
    db.run(`UPDATE pvp_bounties SET status = 'expired' WHERE id = ${id}`);
  }
  save();
  return refunded;
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
      addBalance(userId, ach.reward);
      db.run(`INSERT INTO achievements (user_id, key) VALUES ('${userId}', '${ach.key}')`);
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

// ---- v1.7.0: Free bets (house money) ----
const FREE_BET_DAILY = 500;
const FREE_BET_MAX = 2500;

function getFreeBet(userId) { const u = ensureUser(userId); return u ? (u.free_bet || 0) : 0; }

function claimFreeBet(userId) {
  const u = ensureUser(userId);
  if (!u) return null;
  const now = Math.floor(Date.now() / 1000);
  const today = Math.floor(now / 86400);
  const lastDay = Math.floor((u.free_bet_time || 0) / 86400);
  if (lastDay >= today) return { granted: 0, total: u.free_bet || 0, already: true };
  const total = Math.min((u.free_bet || 0) + FREE_BET_DAILY, FREE_BET_MAX);
  db.run(`UPDATE users SET free_bet = ${total}, free_bet_time = ${now} WHERE user_id = '${userId}'`);
  save();
  return { granted: FREE_BET_DAILY, total };
}

function useFreeBet(userId, amount) {
  const u = ensureUser(userId);
  if (!u || (u.free_bet || 0) < amount) return false;
  db.run(`UPDATE users SET free_bet = free_bet - ${amount} WHERE user_id = '${userId}'`);
  save();
  return true;
}

function addFreeBet(userId, amount) {
  const u = ensureUser(userId);
  if (!u) return;
  const total = Math.min((u.free_bet || 0) + amount, FREE_BET_MAX);
  db.run(`UPDATE users SET free_bet = ${total} WHERE user_id = '${userId}'`);
  save();
}

// ---- v1.7.0: Loss streak protection ----
const LOSS_STREAK_WINDOW = 1800; // 30 min
const LOSS_STREAK_TIERS = [[5, 0.1], [8, 0.15], [12, 0.2]]; // [streak, extra refund]

function registerLoss(userId) {
  const u = ensureUser(userId);
  if (!u) return 1;
  const now = Math.floor(Date.now() / 1000);
  const streak = now - (u.last_loss_time || 0) < LOSS_STREAK_WINDOW ? (u.loss_streak || 0) + 1 : 1;
  db.run(`UPDATE users SET loss_streak = ${streak}, last_loss_time = ${now} WHERE user_id = '${userId}'`);
  save();
  return streak;
}

function resetLossStreak(userId) {
  db.run(`UPDATE users SET loss_streak = 0 WHERE user_id = '${userId}'`);
  save();
}

function lossStreakBonus(streak) {
  let bonus = 0;
  for (const [need, b] of LOSS_STREAK_TIERS) if (streak >= need) bonus = b;
  return bonus;
}

// ---- v1.7.0: Vault interest (per guild, hourly) ----
const VAULT_HOURLY_RATE = 0.004; // 0.4%/hour on vault balance

function accrueVaultInterest() {
  const rows = db.exec(`SELECT guild_id, balance FROM vaults WHERE balance > 0`);
  if (!rows.length) return 0;
  let total = 0;
  for (const v of rows[0].values) {
    const gain = Math.floor(v[1] * VAULT_HOURLY_RATE);
    if (gain <= 0) continue;
    db.run(`UPDATE vaults SET balance = balance + ${gain} WHERE guild_id = '${v[0]}'`);
    total += gain;
  }
  if (total > 0) save();
  return total;
}

// ---- v1.7.0: Pet achievements ----
const PET_ACHIEVEMENTS = {
  battle_first: { name: '⚔️ First Blood', desc: 'win your first battle', reward: 15000 },
  battle_10: { name: '🏅 Fight Club', desc: 'win 10 battles', reward: 100000 },
  level_10: { name: '📈 Reach level 10', desc: 'get any pet to level 10', reward: 20000 },
  level_25: { name: '🚀 Reach level 25', desc: 'get any pet to level 25', reward: 100000 },
  level_50: { name: '🌋 Reach level 50', desc: 'get any pet to level 50', reward: 500000 },
  evolved: { name: '🦋 Evolution', desc: 'evolve any pet', reward: 50000 },
  fused: { name: '🧬 Fusion', desc: 'fuse any two pets', reward: 100000 },
  shiny: { name: '✨ Shiny Collector', desc: 'own a shiny pet', reward: 250000 },
  mythic: { name: '👑 Mythic', desc: 'own a mythic pet', reward: 1000000 },
  fed: { name: '🍖 Well Fed', desc: 'feed any pet', reward: 10000 },
};

function petAchievementsFor(animalId) {
  const rows = db.exec(`SELECT key, at FROM pet_achievements WHERE animal_id = ${animalId} ORDER BY at`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ key: v[0], at: v[1] }));
}

function awardPetAchievement(animalId, key) {
  if (!PET_ACHIEVEMENTS[key]) return null;
  db.run(`INSERT OR IGNORE INTO pet_achievements (animal_id, key) VALUES (${animalId}, '${key}')`);
  save();
}

function getPetAchievementReward(animalId) {
  const rows = db.exec(`SELECT key FROM pet_achievements WHERE animal_id = ${animalId}`);
  if (!rows.length || !rows[0].values.length) return null;
  const k = rows[0].values[0][0];
  return PET_ACHIEVEMENTS[k] || null;
}

// ---- v1.7.0: Evolution ----
const EVOLUTION_COSTS = { common: 50, uncommon: 200, rare: 800, epic: 3000, legendary: 15000 }; // essence to next tier
const EVOLUTION_MIN_LEVEL = 10;

function canEvolve(animal) {
  if (animal.rarity === 'mythic') return { ok: false, reason: 'max' };
  const idx = RARITY_ORDER.indexOf(animal.rarity);
  const next = RARITY_ORDER[idx + 1];
  const cost = EVOLUTION_COSTS[animal.rarity];
  if (!next || !cost) return { ok: false, reason: 'max' };
  const lacksLevel = animal.level < EVOLUTION_MIN_LEVEL;
  if (lacksLevel) return { ok: false, reason: 'level', need: EVOLUTION_MIN_LEVEL };
  return { ok: true, next, cost };
}

function evolveAnimal(animalId, userEssence) {
  const a = getAnimal(animalId);
  if (!a) return { ok: false, reason: 'notfound' };
  const can = canEvolve(a);
  if (!can.ok) return { ok: false, reason: can.reason, need: can.need };
  if (userEssence < can.cost) return { ok: false, reason: 'essence' };
  const newSpecies = randomSpecies(can.next);
  db.run(`UPDATE animals SET species = '${newSpecies}', rarity = '${can.next}', attack = attack + ${Math.floor(a.attack * 0.15)}, defense = defense + ${Math.floor(a.defense * 0.15)}, max_hp = max_hp + ${Math.floor(a.max_hp * 0.15)} WHERE id = ${animalId}`);
  db.run(`UPDATE users SET essence = essence - ${can.cost} WHERE user_id = '${a.user_id}'`);
  awardPetAchievement(animalId, 'evolved');
  save();
  return { ok: true, species: newSpecies, rarity: can.next, cost: can.cost };
}

// ---- v1.7.0: Feeding ----
const FEED_COST = 500;
const FEED_DURATION = 2 * 3600; // 2h buff

function isFed(animal) {
  return animal && animal.fed_until > Math.floor(Date.now() / 1000);
}

function feedAnimal(animalId) {
  const a = getAnimal(animalId);
  if (!a) return { ok: false, reason: 'notfound' };
  const net = Math.floor(Date.now() / 1000);
  const nowF = Math.max(a.fed_until || 0, net);
  db.run(`UPDATE animals SET fed_until = ${nowF + FEED_DURATION} WHERE id = ${animalId}`);
  awardPetAchievement(animalId, 'fed');
  save();
  return { ok: true, fedUntil: nowF + FEED_DURATION };
}

// ---- v1.7.0: Fusion ----
const FUSION_COST = 100000;

function fuseAnimals(userId, id1, id2) {
  const a1 = getAnimal(id1);
  const a2 = getAnimal(id2);
  if (!a1 || !a2) return { ok: false, reason: 'notfound' };
  if (a1.user_id !== userId || a2.user_id !== userId) return { ok: false, reason: 'own' };
  if (a1.id === a2.id) return { ok: false, reason: 'same' };
  if (a1.rarity === 'mythic' || a2.rarity === 'mythic') return { ok: false, reason: 'mythic' };
  const team = getTeam(userId);
  const teamIds = team ? new Set([team.slot1, team.slot2, team.slot3].filter(Boolean)) : new Set();
  if (teamIds.has(id1) || teamIds.has(id2)) return { ok: false, reason: 'team' };
  const rank = Math.max(RARITY_ORDER.indexOf(a1.rarity), RARITY_ORDER.indexOf(a2.rarity));
  const rarity = RARITY_ORDER[rank];
  const species = randomSpecies(rarity);
  const stats = randomStats(rarity);
  const shiny = a1.shiny || a2.shiny ? 1 : 0;
  const trait = rollTrait();
  db.run(`DELETE FROM animals WHERE id IN (${id1}, ${id2})`);
  db.run(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense, level, exp, shiny, trait) VALUES ('${userId}', '${species}', '${rarity}', ${stats.hp}, ${stats.hp}, ${stats.attack}, ${stats.defense}, ${Math.max(a1.level, a2.level)}, ${Math.max(a1.exp, a2.exp)}, ${shiny}, '${trait}')`);
  db.run(`UPDATE users SET balance = balance - ${FUSION_COST} WHERE user_id = '${userId}'`);
  const rows = db.exec('SELECT last_insert_rowid() AS id');
  const id = rows[0].values[0][0];
  awardPetAchievement(id, 'fused');
  save();
  return { ok: true, id, species, rarity, level: Math.max(a1.level, a2.level), shiny: shiny === 1, trait };
}

// ---- v1.7.0: Zoo shop (decorations, cosmetic) ----
const ZOO_DECOR = [
  { id: 'fountain', name: 'Fountain', emoji: '⛲', price: 100000 },
  { id: 'garden', name: 'Flower Garden', emoji: '🌸', price: 150000 },
  { id: 'statues', name: 'Pet Statues', emoji: '🗿', price: 250000 },
  { id: 'lights', name: 'Party Lights', emoji: '✨', price: 300000 },
  { id: 'castle', name: 'Mini Castle', emoji: '🏰', price: 1000000 },
];

function getZooDecors(userId) {
  const u = ensureUser(userId);
  if (!u || !u.zoo_decor) return [];
  try { return JSON.parse(u.zoo_decor); } catch (e) { return []; }
}

function buyZooDecor(userId, decorId) {
  const decor = ZOO_DECOR.find(d => d.id === decorId);
  const u = ensureUser(userId);
  if (!decor || !u) return { ok: false, reason: 'notfound' };
  if ((u.balance || 0) < decor.price) return { ok: false, reason: 'coins' };
  const owned = getZooDecors(userId);
  if (owned.includes(decorId)) return { ok: false, reason: 'owned' };
  db.run(`UPDATE users SET balance = balance - ${decor.price} WHERE user_id = '${userId}'`);
  owned.push(decorId);
  db.run(`UPDATE users SET zoo_decor = '${JSON.stringify(owned).replace(/'/g, "''")}' WHERE user_id = '${userId}'`);
  save();
  return { ok: true, decor };
}

// ---- v1.7.0: Random events ----
const EVENT_TYPES = {
  // ---- gambling wins ----
  gold_rush: { name: 'Gold Rush', desc: 'gambling wins pay +25%', emoji: '🪙', apply: 'winMult', mult: 1.25, duration: 1800, weight: 10 },
  hot_streak: { name: 'Hot Streak', desc: 'gambling wins pay +50%', emoji: '🔥', apply: 'winMult', mult: 1.5, duration: 1800, weight: 10 },
  red_payout: { name: 'Red Payout', desc: 'gambling wins pay +75%', emoji: '💸', apply: 'winMult', mult: 1.75, duration: 2400, weight: 10 },
  lucky_jackpot: { name: 'Lucky Jackpot', desc: 'gambling wins pay DOUBLE', emoji: '🎰', apply: 'winMult', mult: 2, duration: 1500, weight: 8 },
  casino_night: { name: 'Casino Night', desc: 'gambling wins pay TRIPLE', emoji: '🎲', apply: 'winMult', mult: 3, duration: 1200, weight: 4 },
  house_edge: { name: 'House Party', desc: 'gambling wins pay +40% & losses are 20% smaller', emoji: '🥂', apply: 'winMult', mult: 1.4, duration: 1800, weight: 8 },
  high_roller: { name: 'High Roller Hour', desc: 'gambling wins pay +60%', emoji: '♠️', apply: 'winMult', mult: 1.6, duration: 1500, weight: 7 },

  // ---- gems ----
  lucky_hour: { name: 'Lucky Hour', desc: 'gem drops are doubled', emoji: '🍀', apply: 'gemMult', mult: 2, duration: 1800, weight: 10 },
  geodes: { name: 'Geode Storm', desc: 'gem drop chance +50%', emoji: '🪨', apply: 'gemMult', mult: 1.5, duration: 2400, weight: 10 },
  gem_bonanza: { name: 'Gem Bonanza', desc: 'gem drops are tripled', emoji: '💎', apply: 'gemMult', mult: 3, duration: 1800, weight: 8 },
  gem_tsunami: { name: 'Gem Tsunami', desc: 'gem drops are 4x', emoji: '🌊', apply: 'gemMult', mult: 4, duration: 1200, weight: 4 },
  prismatic: { name: 'Prismatic Rain', desc: 'every hunt drops at least 1 gem', emoji: '🌈', apply: 'gemMult', mult: 2.5, duration: 1500, weight: 6 },

  // ---- eggs ----
  egg_surge: { name: 'Egg Surge', desc: 'egg drops +50%', emoji: '🥚', apply: 'eggMult', mult: 1.5, duration: 2400, weight: 10 },
  egg_mania: { name: 'Egg Mania', desc: 'egg drops are doubled', emoji: '🐣', apply: 'eggMult', mult: 2, duration: 1800, weight: 10 },
  hatch_madness: { name: 'Hatch Madness', desc: 'egg drops are tripled', emoji: '🐥', apply: 'eggMult', mult: 3, duration: 1800, weight: 8 },
  egg_frenzy: { name: 'Egg Frenzy', desc: 'egg drops are 5x', emoji: '🐤', apply: 'eggMult', mult: 5, duration: 900, weight: 3 },
  nest_overflow: { name: 'Nest Overflow', desc: 'egg drops +75%', emoji: '🪺', apply: 'eggMult', mult: 1.75, duration: 2100, weight: 9 },

  // ---- essence ----
  ess_boost: { name: 'Essence Boost', desc: 'sacrificing gives +50% essence', emoji: '✨', apply: 'essenceMult', mult: 1.5, duration: 2400, weight: 10 },
  essence_surge: { name: 'Essence Surge', desc: 'sacrificing gives double essence', emoji: '🔮', apply: 'essenceMult', mult: 2, duration: 1800, weight: 10 },
  essence_flood: { name: 'Essence Flood', desc: 'sacrificing gives 4x essence', emoji: '💜', apply: 'essenceMult', mult: 4, duration: 1800, weight: 8 },
  essence_tsunami: { name: 'Essence Tsunami', desc: 'sacrificing gives 6x essence', emoji: '🌌', apply: 'essenceMult', mult: 6, duration: 900, weight: 3 },
  spirit_pact: { name: 'Spirit Pact', desc: 'sacrificing gives +100% essence', emoji: '👻', apply: 'essenceMult', mult: 2, duration: 2000, weight: 7 },

  // ---- daily / weekly rewards ----
  payday_plus: { name: 'Payday Plus', desc: 'daily & weekly rewards +50%', emoji: '📈', apply: 'rewardMult', mult: 1.5, duration: 2400, weight: 10 },
  double_payday: { name: 'Double Payday', desc: 'daily & weekly rewards are doubled', emoji: '💰', apply: 'rewardMult', mult: 2, duration: 3600, weight: 8 },
  mega_payday: { name: 'Mega Payday', desc: 'daily & weekly rewards are 2.5x', emoji: '🤑', apply: 'rewardMult', mult: 2.5, duration: 2400, weight: 4 },

  // ---- shop ----
  shop_sale: { name: 'Shop Sale', desc: 'shop prices are 30% off', emoji: '🏷️', apply: 'priceMult', mult: 0.7, duration: 2700, weight: 10 },
  shop_closeout: { name: 'Closeout Sale', desc: 'shop prices are 40% off', emoji: '🛍️', apply: 'priceMult', mult: 0.6, duration: 3600, weight: 8 },
  shop_clearance: { name: 'Clearance', desc: 'shop prices are HALF off', emoji: '⚡', apply: 'priceMult', mult: 0.5, duration: 2700, weight: 6 },

  // ---- work ----
  work_boost: { name: 'Hustle Week', desc: 'work pays +50%', emoji: '💪', apply: 'workMult', mult: 1.5, duration: 3600, weight: 10 },
  overtime: { name: 'Overtime', desc: 'work pays DOUBLE', emoji: '⏰', apply: 'workMult', mult: 2, duration: 2700, weight: 8 },
  mega_work: { name: 'Mega Shift', desc: 'work pays TRIPLE', emoji: '🏭', apply: 'workMult', mult: 3, duration: 1800, weight: 4 },

  // ---- hunting xp ----
  wild_xp: { name: 'Wild XP', desc: 'hunting gives +50% animal XP', emoji: '📚', apply: 'xpMult', mult: 1.5, duration: 2700, weight: 10 },
  hunt_frenzy: { name: 'Hunting Frenzy', desc: 'hunting gives DOUBLE animal XP', emoji: '🐾', apply: 'xpMult', mult: 2, duration: 1800, weight: 8 },
  elite_training: { name: 'Elite Training', desc: 'hunting gives TRIPLE animal XP', emoji: '🥋', apply: 'xpMult', mult: 3, duration: 1200, weight: 4 },

  // ---- battles ----
  war_bonus: { name: 'War Bonus', desc: 'battle winners earn +50% coins', emoji: '⚔️', apply: 'battleMult', mult: 1.5, duration: 2400, weight: 10 },
  battle_fury: { name: 'Battle Fury', desc: 'battle winners earn DOUBLE coins', emoji: '🛡️', apply: 'battleMult', mult: 2, duration: 1800, weight: 8 },
  conquest: { name: 'Conquest', desc: 'battle winners earn +75% coins', emoji: '🏴', apply: 'battleMult', mult: 1.75, duration: 2000, weight: 6 },

  // ---- trait upgrades (NEW) ----
  trait_discount: { name: 'Trait Discount', desc: 'trait upgrades cost 30% less essence', emoji: '🔧', apply: 'traitMult', mult: 0.7, duration: 2400, weight: 9 },
  trait_sale: { name: 'Trait Clearance', desc: 'trait upgrades cost HALF essence', emoji: '🏗️', apply: 'traitMult', mult: 0.5, duration: 2000, weight: 5 },
  trait_freebie: { name: 'Free Upgrade', desc: 'trait upgrades cost 60% less essence', emoji: '🎁', apply: 'traitMult', mult: 0.4, duration: 1500, weight: 3 },

  // ---- crates (NEW) ----
  crate_discount: { name: 'Crate Sale', desc: 'all crates are 25% off', emoji: '📦', apply: 'crateMult', mult: 0.75, duration: 2400, weight: 9 },
  crate_clearance: { name: 'Crate Clearance', desc: 'all crates are HALF off', emoji: '🗃️', apply: 'crateMult', mult: 0.5, duration: 1800, weight: 5 },
  pity_boost: { name: 'Pity Surge', desc: 'crate pity builds +50% faster', emoji: '🌟', apply: 'pityMult', mult: 1.5, duration: 2000, weight: 7 },
  guaranteed_rare: { name: 'Jackpot Pull', desc: 'crate pity builds DOUBLE speed', emoji: '🏆', apply: 'pityMult', mult: 2, duration: 1500, weight: 4 },

  // ---- battle pass (NEW) ----
  pass_boost: { name: 'Pass Boost', desc: 'battle pass XP is doubled', emoji: '🏅', apply: 'passXpMult', mult: 2, duration: 2400, weight: 8 },
  pass_frenzy: { name: 'Pass Frenzy', desc: 'battle pass XP is TRIPLED', emoji: '🚀', apply: 'passXpMult', mult: 3, duration: 1500, weight: 4 },

  // ---- hunt capacity (NEW) ----
  big_game: { name: 'Big Game', desc: 'hunt capacity +4 for the duration', emoji: '🦏', apply: 'huntCapMult', mult: 4, duration: 1800, weight: 7 },
  overgrowth: { name: 'Overgrowth', desc: 'hunt capacity +6', emoji: '🌿', apply: 'huntCapMult', mult: 6, duration: 1500, weight: 4 },

  // ---- autohunt (NEW) ----
  swarm: { name: 'Animal Swarm', desc: 'autohunt cycles produce +2 animals', emoji: '🐺', apply: 'autohuntMult', mult: 2, duration: 2000, weight: 6 },
  stampede: { name: 'Stampede', desc: 'autohunt cycles produce +3 animals', emoji: '🦬', apply: 'autohuntMult', mult: 3, duration: 1500, weight: 3 },

  // ---- streak protection (NEW) ----
  streak_shield: { name: 'Streak Shield', desc: 'your daily streak won\'t reset for 24h', emoji: '🛡️', apply: 'streakFreeze', duration: 86400, weight: 5 },

  // ---- instant payouts ----
  coin_rain: { name: 'Coin Rain', desc: 'everyone gets +50k coins', emoji: '🌧️', apply: 'rain', duration: 300, weight: 8 },
  gem_rain: { name: 'Gem Rain', desc: 'everyone gets +25 gems', emoji: '💠', apply: 'rain', duration: 300, weight: 6 },
  egg_shower: { name: 'Egg Shower', desc: 'everyone gets +3 eggs', emoji: '☔', apply: 'rain', duration: 300, weight: 5 },
  seal_drizzle: { name: 'Seal Drizzle', desc: 'everyone gets +2 seals', emoji: '🎫', apply: 'rain', duration: 300, weight: 5 },
  lucky_rain: { name: 'Lucky Rain', desc: 'everyone gets +150k coins, +30 gems, +3 eggs & +2 seals', emoji: '🌈', apply: 'rain', duration: 300, weight: 4 },
  essence_deluge: { name: 'Essence Deluge', desc: 'everyone gets +50 essence', emoji: '💜', apply: 'rain', duration: 300, weight: 5 },
};

const RAIN_REWARDS = {
  coin_rain: { coins: 50000 },
  gem_rain: { gems: 25 },
  egg_shower: { eggs: 3 },
  seal_drizzle: { seals: 2 },
  lucky_rain: { coins: 150000, gems: 30, eggs: 3, seals: 2 },
  essence_deluge: { essence: 50 },
};

function applyRain(key) {
  const r = RAIN_REWARDS[key];
  if (!r) return { coins: 0, gems: 0, eggs: 0, seals: 0, essence: 0 };
  if (r.coins) db.run(`UPDATE users SET balance = balance + ${r.coins}`);
  if (r.gems) db.run(`UPDATE users SET gems = gems + ${r.gems}`);
  if (r.eggs) db.run(`UPDATE users SET eggs = eggs + ${r.eggs}`);
  if (r.seals) db.run(`UPDATE users SET seals = seals + ${r.seals}`);
  if (r.essence) db.run(`UPDATE users SET essence = essence + ${r.essence}`);
  save();
  return { coins: r.coins || 0, gems: r.gems || 0, eggs: r.eggs || 0, seals: r.seals || 0, essence: r.essence || 0 };
}

function getActiveEvent() {
  const rows = db.exec(`SELECT key, ends_at FROM events LIMIT 1`);
  if (!rows.length || !rows[0].values.length) return null;
  const [key, endsAt] = rows[0].values[0];
  if (Date.now() / 1000 > endsAt) {
    db.run(`DELETE FROM events WHERE key = '${key}'`);
    save();
    return null;
  }
  return { key, endsAt };
}

let lastEventKey = null;

function startRandomEvent() {
  const keys = Object.keys(EVENT_TYPES);
  const pool = keys.filter(k => k !== lastEventKey);
  const total = pool.reduce((a, k) => a + (EVENT_TYPES[k].weight || 10), 0);
  let roll = Math.random() * total;
  let key = pool[0];
  for (const k of pool) {
    roll -= (EVENT_TYPES[k].weight || 10);
    if (roll <= 0) { key = k; break; }
  }
  lastEventKey = key;
  const ev = EVENT_TYPES[key];
  db.run(`DELETE FROM events`);
  db.run(`INSERT INTO events (key, type, ends_at) VALUES ('${key}', '${ev.apply}', ${Math.floor(Date.now() / 1000) + ev.duration})`);
  save();
  return { key, ...ev, endsAt: Math.floor(Date.now() / 1000) + ev.duration };
}

function eventMult(apply) {
  // Events disabled — always return 1 (no multiplier)
  return 1;
}

// ---- v1.8.0: Travelling merchant (rare rotating stock) ----
const MERCHANT_OWNER_ID = '__merchant__';
const MERCHANT_FIRST_MS = 60 * 60 * 1000;
const MERCHANT_DWELL_MS = 90 * 60 * 1000;
const MERCHANT_PET_PRICES = { common: 250000, uncommon: 600000, rare: 1200000, epic: 3000000, legendary: 8000000, mythic: 20000000 };

function getNextMerchantArrival() {
  // Merchant disabled — return far future so it never triggers
  return Math.floor(Date.now() / 1000) + 999999999;
}

function refreshMerchant() {
  db.run(`DELETE FROM merchant_stock`);
  const eff = 3 + Math.floor(Math.random() * 3);
  const animal = addAnimal(MERCHANT_OWNER_ID, eff);
  const petSpec = getAnimal(animal.id);
  const petPrice = Math.floor(MERCHANT_PET_PRICES[petSpec.rarity]);
  db.run(`INSERT INTO merchant_stock (slot, kind, label, price, extra) VALUES (0, 'pet', '${petSpec.rarity.toUpperCase()} ${petSpec.species} (mystery grab bag)', ${petPrice}, '${animal.id}')`);
  db.run(`INSERT INTO merchant_stock (slot, kind, label, price, extra) VALUES (1, 'gems', 'Gems x10', 8000000, '10')`);
  db.run(`INSERT INTO merchant_stock (slot, kind, label, price, extra) VALUES (2, 'essence', 'Essence x25', 3500000, '25')`);
  const nowTs = Math.floor(Date.now() / 1000);
  const nextAt = nowTs + Math.floor(MERCHANT_DWELL_MS / 1000);
  db.run(`INSERT OR REPLACE INTO merchant_state (id, next_at) VALUES (1, ${nextAt})`);
  save();
  return { slots: getMerchantItems(), next_at: nextAt };
}

function getMerchantItems() {
  const rows = db.exec(`SELECT slot, kind, label, price, sold_to, extra FROM merchant_stock ORDER BY slot`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ slot: v[0], kind: v[1], label: v[2], price: v[3], sold_to: v[4], extra: v[5] }));
}

function buyMerchantItem(userId, slot) {
  const item = getMerchantItems().find(x => x.slot === Number(slot));
  if (!item) return { ok: false, reason: 'gone' };
  if (item.sold_to) return { ok: false, reason: 'sold' };
  const u = ensureUser(userId);
  if (!u || (u.balance || 0) < item.price) return { ok: false, reason: 'coins' };
  if (item.kind === 'pet') {
    const a = getAnimal(Number(item.extra));
    if (!a || a.user_id !== MERCHANT_OWNER_ID) return { ok: false, reason: 'gone' };
  }
  db.run(`UPDATE users SET balance = balance - ${item.price} WHERE user_id = '${userId}'`);
  if (item.kind === 'pet') {
    db.run(`UPDATE animals SET user_id = '${userId}' WHERE id = ${item.extra} AND user_id = '${MERCHANT_OWNER_ID}'`);
  } else if (item.kind === 'gems') {
    addGems(userId, parseInt(item.extra || '10', 10));
  } else if (item.kind === 'essence') {
    addEssence(userId, parseInt(item.extra || '25', 10));
  }
  db.run(`UPDATE merchant_stock SET sold_to = '${userId}' WHERE slot = ${item.slot}`);
  save();
  return { ok: true, item };
}

// ---- v1.7.0: Plots / land ----
const PLOT_BASE_PRICE = 500000;
const PLOT_UPGRADE_COST = 400000;
const PLOT_INCOME_PER_HOUR = 300;
const PLOT_MAX_LEVEL = 5;

function getPlot(userId) {
  const rows = db.exec(`SELECT * FROM plots WHERE user_id = '${userId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { user_id: v[0], level: v[1], planted_at: v[2], last_claim: v[3] };
}

function buyPlot(userId) {
  if (getPlot(userId)) return { ok: false, reason: 'owned' };
  const u = ensureUser(userId);
  if (!u || (u.balance || 0) < PLOT_BASE_PRICE) return { ok: false, reason: 'coins' };
  const now = Math.floor(Date.now() / 1000);
  db.run(`UPDATE users SET balance = balance - ${PLOT_BASE_PRICE} WHERE user_id = '${userId}'`);
  db.run(`INSERT INTO plots (user_id, level, planted_at, last_claim) VALUES ('${userId}', 1, ${now}, ${now})`);
  save();
  return { ok: true, level: 1 };
}

function upgradePlot(userId) {
  const p = getPlot(userId);
  if (!p) return { ok: false, reason: 'noplot' };
  if (p.level >= PLOT_MAX_LEVEL) return { ok: false, reason: 'max' };
  const u = ensureUser(userId);
  const cost = PLOT_UPGRADE_COST * p.level;
  if ((u.balance || 0) < cost) return { ok: false, reason: 'coins' };
  db.run(`UPDATE users SET balance = balance - ${cost} WHERE user_id = '${userId}'`);
  db.run(`UPDATE plots SET level = level + 1 WHERE user_id = '${userId}'`);
  save();
  return { ok: true, level: p.level + 1, cost };
}

function claimPlot(userId) {
  const p = getPlot(userId);
  if (!p) return { ok: false, reason: 'noplot' };
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.min(now - p.last_claim, 24 * 3600);
  if (elapsed < 3600) return { ok: false, reason: 'toosoon', wait: 3600 - elapsed };
  const income = Math.floor(elapsed / 3600 * PLOT_INCOME_PER_HOUR * p.level);
  db.run(`UPDATE users SET balance = balance + ${income} WHERE user_id = '${userId}'`);
  db.run(`UPDATE plots SET last_claim = ${now}, planted_at = ${now} WHERE user_id = '${userId}'`);
  save();
  return { ok: true, income, hours: Math.floor(elapsed / 3600) };
}

// ---- v1.7.0: Clans ----
const CLAN_CREATE_COST = 5000000;
const CLAN_MAX_MEMBERS = 20;

function getClan(clanId) {
  const rows = db.exec(`SELECT * FROM clans WHERE clan_id = '${clanId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { clan_id: v[0], name: v[1], owner_id: v[2], balance: v[3], created_at: v[4] };
}

function createClan(ownerId, name) {
  if (getClan(ownerId)) return { ok: false, reason: 'created' };
  const memberOf = getClanOf(ownerId);
  if (memberOf) return { ok: false, reason: 'member' };
  const u = ensureUser(ownerId);
  if (!u || (u.balance || 0) < CLAN_CREATE_COST) return { ok: false, reason: 'coins' };
  const safe = (name || '').slice(0, 20).replace(/'/g, "''");
  if (!safe) return { ok: false, reason: 'name' };
  db.run(`UPDATE users SET balance = balance - ${CLAN_CREATE_COST} WHERE user_id = '${ownerId}'`);
  db.run(`INSERT INTO clans (clan_id, name, owner_id) VALUES ('${ownerId}', '${safe}', '${ownerId}')`);
  db.run(`INSERT OR IGNORE INTO clan_members (clan_id, user_id) VALUES ('${ownerId}', '${ownerId}')`);
  save();
  return { ok: true, name: safe };
}

function getClanMembers(clanId) {
  const rows = db.exec(`SELECT user_id FROM clan_members WHERE clan_id = '${clanId}' ORDER BY joined_at`);
  if (!rows.length) return [];
  return rows[0].values.map(v => v[0]);
}

function getClanOf(userId) {
  const m = db.exec(`SELECT clan_id FROM clan_members WHERE user_id = '${userId}' LIMIT 1`);
  return m.length && m[0].values.length ? m[0].values[0][0] : null;
}

function findClanByName(name) {
  const safe = (name || '').replace(/'/g, "''");
  const rows = db.exec(`SELECT clan_id FROM clans WHERE lower(name) = lower('${safe}') LIMIT 1`);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0];
}

function clanJoin(clanId, userId) {
  const clan = getClan(clanId);
  if (!clan) return { ok: false, reason: 'noclan' };
  if (getClanOf(userId)) return { ok: false, reason: 'member' };
  if (getClanMembers(clanId).length >= CLAN_MAX_MEMBERS) return { ok: false, reason: 'full' };
  db.run(`INSERT OR IGNORE INTO clan_members (clan_id, user_id) VALUES ('${clanId}', '${userId}')`);
  save();
  return { ok: true };
}

function clanLeave(clanId, userId) {
  const clan = getClan(clanId);
  if (!clan) return { ok: false, reason: 'noclan' };
  if (clan.owner_id === userId) return { ok: false, reason: 'owner' };
  db.run(`DELETE FROM clan_members WHERE clan_id = '${clanId}' AND user_id = '${userId}'`);
  save();
  return { ok: true };
}

function clanKick(clanId, ownerId, userId) {
  const clan = getClan(clanId);
  if (!clan || clan.owner_id !== ownerId) return { ok: false, reason: 'owner' };
  if (userId === ownerId) return { ok: false, reason: 'self' };
  db.run(`DELETE FROM clan_members WHERE clan_id = '${clanId}' AND user_id = '${userId}'`);
  save();
  return { ok: true };
}

function clanDeposit(clanId, userId, amount) {
  const clan = getClan(clanId);
  const u = ensureUser(userId);
  if (!clan || !u || (u.balance || 0) < amount) return { ok: false, reason: 'coins' };
  db.run(`UPDATE users SET balance = balance - ${amount} WHERE user_id = '${userId}'`);
  db.run(`UPDATE clans SET balance = balance + ${amount} WHERE clan_id = '${clanId}'`);
  save();
  return { ok: true };
}

function clanWithdraw(clanId, ownerId, amount) {
  const clan = getClan(clanId);
  if (!clan || clan.owner_id !== ownerId) return { ok: false, reason: 'owner' };
  if (clan.balance < amount) return { ok: false, reason: 'balance' };
  db.run(`UPDATE clans SET balance = balance - ${amount} WHERE clan_id = '${clanId}'`);
  addBalance(ownerId, amount);
  return { ok: true };
}

function deleteClan(clanId, ownerId) {
  const clan = getClan(clanId);
  if (!clan || clan.owner_id !== ownerId) return { ok: false, reason: 'owner' };
  const refund = Math.floor(clan.balance / 2);
  db.run(`DELETE FROM clans WHERE clan_id = '${clanId}'`);
  db.run(`DELETE FROM clan_members WHERE clan_id = '${clanId}'`);
  addBalance(ownerId, refund);
  save();
  return { ok: true, refund };
}

function getClanTop(limit = 10) {
  const rows = db.exec(`SELECT clan_id, name, balance FROM clans ORDER BY balance DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ clan_id: v[0], name: v[1], balance: v[2] }));
}

// ---- Clan wars (v1.8.0): treasury-staked clan vs clan battles ----
const CLAN_WAR_MIN = 1000000;
const CLAN_WAR_MAX_PCT = 0.25;
const CLAN_WAR_ACCEPT_MS = 60000;
const CLAN_WAR_FIGHT_MS = 120000;

function clanBalanceAdd(clanId, amount) {
  db.run(`UPDATE clans SET balance = balance + ${amount} WHERE clan_id = '${clanId}'`);
}

function getClanWar(code) {
  const rows = db.exec(`SELECT * FROM clan_wars WHERE code = '${code}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { code: v[0], attacker: v[1], defender: v[2], stake: v[3], status: v[4], winner: v[5], ends_at: v[6], channel_id: v[7], msg_id: v[8] };
}

function getOpenClanWars() {
  const rows = db.exec(`SELECT code FROM clan_wars WHERE status = 'fighting' OR status = 'challenge' ORDER BY ends_at`);
  if (!rows.length) return [];
  return rows[0].values.map(v => getClanWar(v[0]));
}

function setClanWarMsg(code, msgId) {
  db.run(`UPDATE clan_wars SET msg_id = '${msgId}' WHERE code = '${code}'`);
  save();
}

function startClanWar(challengerClan, defenderClan, stake, channelId) {
  if (!challengerClan || !defenderClan) return { ok: false, reason: 'noclan' };
  if (challengerClan.clan_id === defenderClan.clan_id) return { ok: false, reason: 'same' };
  if (!stake || stake < CLAN_WAR_MIN) return { ok: false, reason: 'min', min: CLAN_WAR_MIN };
  const maxBet = Math.floor(Math.min(challengerClan.balance, defenderClan.balance) * CLAN_WAR_MAX_PCT);
  if (stake > maxBet) return { ok: false, reason: 'max', maxBet };
  const code = `cw${Math.floor(Math.random() * 0xffffff).toString(36)}${Date.now().toString(36)}`;
  const now = Math.floor(Date.now() / 1000);
  db.run(`INSERT INTO clan_wars (code, attacker, defender, stake, status, ends_at, channel_id) VALUES ('${code}', '${challengerClan.clan_id}', '${defenderClan.clan_id}', ${stake}, 'challenge', ${now + CLAN_WAR_ACCEPT_MS / 1000}, '${channelId || ''}')`);
  save();
  return { ok: true, code, stake };
}

function acceptClanWar(code, clanId) {
  const w = getClanWar(code);
  if (!w || w.status !== 'challenge') return { ok: false, reason: 'closed' };
  if (w.defender !== clanId) return { ok: false, reason: 'defender' };
  const atk = getClan(w.attacker);
  const def = getClan(w.defender);
  if (!atk || atk.balance < w.stake) return { ok: false, reason: 'atkco' };
  if (!def || def.balance < w.stake) return { ok: false, reason: 'defco' };
  db.run(`UPDATE clans SET balance = balance - ${w.stake} WHERE clan_id = '${w.attacker}'`);
  db.run(`UPDATE clans SET balance = balance - ${w.stake} WHERE clan_id = '${w.defender}'`);
  const endFight = Math.floor(Date.now() / 1000) + CLAN_WAR_FIGHT_MS / 1000;
  db.run(`UPDATE clan_wars SET status = 'fighting', ends_at = ${endFight} WHERE code = '${code}'`);
  save();
  return { ok: true, w, atk, def, ends_at: endFight };
}

function declineClanWar(code, clanId) {
  const w = getClanWar(code);
  if (!w || w.status !== 'challenge') return { ok: false, reason: 'closed' };
  if (w.defender !== clanId) return { ok: false, reason: 'defender' };
  db.run(`UPDATE clan_wars SET status = 'done', winner = '' WHERE code = '${code}'`);
  save();
  return { ok: true };
}

function clanWarFight(code, clanId, userId) {
  const w = getClanWar(code);
  if (!w || w.status !== 'fighting') return { ok: false, reason: 'over' };
  if (w.attacker !== clanId && w.defender !== clanId) return { ok: false, reason: 'clan' };
  if (!getClanMembers(clanId).includes(userId)) return { ok: false, reason: 'member' };
  const already = db.exec(`SELECT user_id FROM clan_war_fighters WHERE code = '${code}' AND user_id = '${userId}'`);
  if (already.length && already[0].values.length) return { ok: false, reason: 'joined' };
  const animals = getUserAnimals(userId);
  const petsPower = Math.min(200, Math.floor(1.5 * animals.reduce((s, a) => s + Math.round(a.attack * 0.8 + a.level * 3 + a.hp / 100), 0)));
  const power = petsPower + 20 + Math.floor(Math.random() * 50);
  db.run(`INSERT INTO clan_war_fighters (code, clan_id, user_id, power) VALUES ('${code}', '${clanId}', '${userId}', ${power})`);
  save();
  return { ok: true, power };
}

function getClanWarFighters(code) {
  const rows = db.exec(`SELECT clan_id, user_id, power FROM clan_war_fighters WHERE code = '${code}'`);
  if (!rows.length) return { attacker: [], defender: [] };
  const out = { attacker: [], defender: [] };
  const w = getClanWar(code);
  for (const v of rows[0].values) {
    if (v[0] === (w && w.attacker)) out.attacker.push({ user_id: v[1], power: v[2] });
    else out.defender.push({ user_id: v[1], power: v[2] });
  }
  return out;
}

function resolveClanWars(now = Math.floor(Date.now() / 1000)) {
  const expired = db.exec(`SELECT code FROM clan_wars WHERE status = 'challenge' AND ends_at <= ${now}`);
  if (expired.length) {
    for (const v of expired[0].values) {
      db.run(`UPDATE clan_wars SET status = 'done', winner = NULL WHERE code = '${v[0]}'`);
    }
    save();
  }
  const rows = db.exec(`SELECT code FROM clan_wars WHERE status = 'fighting' AND ends_at <= ${now}`);
  const results = [];
  if (!rows.length) return results;
  for (const v of rows[0].values) {
    const w = getClanWar(v[0]);
    if (!w) continue;
    const fighters = getClanWarFighters(w.code);
    const aPower = fighters.attacker.reduce((s, f) => s + f.power, 0);
    const dPower = fighters.defender.reduce((s, f) => s + f.power, 0);
    let winner = '';
    if (aPower > 0 && dPower > 0) {
      if (aPower > dPower) winner = w.attacker;
      else if (dPower > aPower) winner = w.defender;
    }
    if (winner) {
      clanBalanceAdd(winner, w.stake * 2);
    } else {
      clanBalanceAdd(w.attacker, w.stake);
      clanBalanceAdd(w.defender, w.stake);
    }
    db.run(`UPDATE clan_wars SET status = 'done', winner = ${winner === '' ? 'NULL' : `'${winner}'`} WHERE code = '${w.code}'`);
    save();
    results.push({ w, code: w.code, atPower: aPower, dPower, winner, pot: winner ? w.stake * 2 : 0 });
  }
  return results;
}

// ---- v1.7.0: Auction house (bidding wars) ----
function createAuction(auctionId, guildId, sellerId, animalId, minBid, hours) {
  const a = getAnimal(animalId);
  if (!a || a.user_id !== sellerId) return { ok: false, reason: 'notfound' };
  if (hours < 1 || hours > 72) return { ok: false, reason: 'time' };
  const team = getTeam(sellerId);
  if (team && [team.slot1, team.slot2, team.slot3].includes(animalId)) return { ok: false, reason: 'team' };
  db.run(`INSERT INTO bids (auction_id, guild_id, seller_id, animal_id, min_bid, current_bid, current_bidder, ends_at) VALUES ('${auctionId}', '${guildId}', '${sellerId}', ${animalId}, ${minBid}, ${minBid}, NULL, ${Math.floor(Date.now() / 1000) + hours * 3600})`);
  save();
  return { ok: true };
}

function getAuction(auctionId) {
  const rows = db.exec(`SELECT * FROM bids WHERE auction_id = '${auctionId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  return { auction_id: v[0], guild_id: v[1], seller_id: v[2], animal_id: v[3], min_bid: v[4], current_bid: v[5], current_bidder: v[6], ends_at: v[7] };
}

function listAuctions(guildId) {
  const rows = db.exec(`SELECT * FROM bids WHERE guild_id = '${guildId}' AND ends_at > ${Math.floor(Date.now() / 1000)} ORDER BY ends_at`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ auction_id: v[0], guild_id: v[1], seller_id: v[2], animal_id: v[3], min_bid: v[4], current_bid: v[5], current_bidder: v[6], ends_at: v[7] }));
}

function placeBid(auctionId, bidderId, amount) {
  const auc = getAuction(auctionId);
  if (!auc) return { ok: false, reason: 'notfound' };
  if (Math.floor(Date.now() / 1000) > auc.ends_at) return { ok: false, reason: 'ended' };
  if (auc.seller_id === bidderId) return { ok: false, reason: 'self' };
  const minIncrement = Math.max(500, Math.floor(auc.current_bid * 0.05));
  if (amount < auc.current_bid + minIncrement) return { ok: false, reason: 'low', min: auc.current_bid + minIncrement };
  const u = ensureUser(bidderId);
  if (!u || (u.balance || 0) < amount) return { ok: false, reason: 'coins' };
  if (auc.current_bidder) {
    addBalance(auc.current_bidder, auc.current_bid);
  }
  db.run(`UPDATE users SET balance = balance - ${amount} WHERE user_id = '${bidderId}'`);
  db.run(`UPDATE bids SET current_bid = ${amount}, current_bidder = '${bidderId}' WHERE auction_id = '${auctionId}'`);
  save();
  return { ok: true, amount };
}

function endAuction(auctionId) {
  const auc = getAuction(auctionId);
  if (!auc) return null;
  const a = getAnimal(auc.animal_id);
  db.run(`DELETE FROM bids WHERE auction_id = '${auctionId}'`);
  if (!auc.current_bidder) return { ok: false, reason: 'nobids' };
  const fee = Math.floor(auc.current_bid * 0.05);
  addBalance(auc.seller_id, auc.current_bid - fee);
  if (a) {
    transferAnimal(auc.animal_id, auc.seller_id, auc.current_bidder);
  }
  save();
  return { ok: true, price: auc.current_bid, fee, winner: auc.current_bidder, animal: a };
}

function cancelAuction(auctionId, userId) {
  const auc = getAuction(auctionId);
  if (!auc) return { ok: false, reason: 'notfound' };
  if (auc.seller_id !== userId) return { ok: false, reason: 'owner' };
  db.run(`DELETE FROM bids WHERE auction_id = '${auctionId}'`);
  if (auc.current_bidder) addBalance(auc.current_bidder, auc.current_bid);
  save();
  return { ok: true };
}

function cleanupExpiredAuctions() {
  const rows = db.exec(`SELECT auction_id FROM bids WHERE ends_at <= ${Math.floor(Date.now() / 1000)}`);
  if (!rows.length) return 0;
  let n = 0;
  for (const v of rows[0].values) { endAuction(v[0]); n++; }
  return n;
}

// ---- v1.7.0: Boss raids (per guild) ----
const BOSS_BASE_HP = 5000;
// ---- v1.7.0: Lootbox crates + pity ----
const CRATES = {
  common: { name: 'Common Crate', price: 30000, weights: { common: 62, uncommon: 24, rare: 11, epic: 3 }, pity: 8, pityRarity: 'rare' },
  premium: { name: 'Premium Crate', price: 250000, weights: { common: 20, uncommon: 35, rare: 30, epic: 12, legendary: 3 }, pity: 12, pityRarity: 'epic' },
  mythic: { name: 'Mythic Crate', price: 1000000, weights: { uncommon: 15, rare: 30, epic: 30, legendary: 20, mythic: 5 }, pity: 15, pityRarity: 'legendary' },
};

function getCratePity(userId) { const u = ensureUser(userId); return u ? (u.crate_pity || 0) : 0; }

function setCratePity(userId, val) {
  db.run(`UPDATE users SET crate_pity = ${Math.max(0, val)} WHERE user_id = '${userId}'`);
  save();
}

function rollCrateRarity(crateId, pity) {
  const crate = CRATES[crateId];
  if (!crate) return null;
  if (pity >= crate.pity) return crate.pityRarity;
  const total = Object.values(crate.weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rar, w] of Object.entries(crate.weights)) {
    roll -= w;
    if (roll <= 0) return rar;
  }
  return 'common';
}

function openCrate(userId, crateId) {
  const crate = CRATES[crateId];
  const u = ensureUser(userId);
  if (!crate || !u) return { ok: false, reason: 'notfound' };
  const price = Math.max(1, Math.floor(crate.price * eventMult('crateMult')));
  if ((u.balance || 0) < price) return { ok: false, reason: 'coins' };
  const pityGain = Math.max(1, Math.round(eventMult('pityMult')));
  const pity = getCratePity(userId) + pityGain;
  const rarity = rollCrateRarity(crateId, pity);
  setCratePity(userId, rarity === crate.pityRarity ? 0 : pity);
  db.run(`UPDATE users SET balance = balance - ${price} WHERE user_id = '${userId}'`);
  const shiny = rollShiny() ? 1 : 0;
  const trait = rollTrait();
  const species = randomSpecies(rarity);
  const stats = randomStats(rarity);
  db.run(`INSERT INTO animals (user_id, species, rarity, hp, max_hp, attack, defense, shiny, trait) VALUES ('${userId}', '${species}', '${rarity}', ${stats.hp}, ${stats.hp}, ${stats.attack}, ${stats.defense}, ${shiny}, '${trait}')`);
  const rows = db.exec('SELECT last_insert_rowid() AS id');
  const id = rows[0].values[0][0];
  save();
  if (shiny) awardPetAchievement(id, 'shiny');
  if (rarity === 'mythic') awardPetAchievement(id, 'mythic');
  const bonus = rarity === 'mythic' ? 250 : rarity === 'legendary' ? 100 : rarity === 'epic' ? 50 : 0;
  let gems = 0;
  let essence = 0;
  if (bonus > 0 && Math.random() < 0.5) { gems = Math.floor(bonus * 0.05); db.run(`UPDATE users SET gems = gems + ${gems} WHERE user_id = '${userId}'`); save(); }
  if (bonus > 0 && Math.random() < 0.5) { essence = bonus; addEssence(userId, essence); }
  return { ok: true, id, species, rarity, shiny: shiny === 1, trait, pity, crate: crate.name, gems, essence };
}

const BOSS_POT_TAX = 0.05;
const BOSS_LIFE = 30 * 60; // 30 min

function getBoss(guildId) {
  const rows = db.exec(`SELECT * FROM world_boss WHERE boss_id = '${guildId}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const v = rows[0].values[0];
  const boss = { boss_id: v[0], species: v[1], rarity: v[2], hp: v[3], max_hp: v[4], pot: v[5], ends_at: v[6], level: v[7] };
  if (boss.hp <= 0) return null;
  return boss;
}

function spawnBoss(guildId, memberCount) {
  const rarity = Math.random() < 0.7 ? 'epic' : 'legendary';
  const species = randomSpecies(rarity);
  const level = Math.max(1, Math.min(5, Math.floor((memberCount || 5) / 5)));
  const stats = randomStats(rarity);
  const hp = Math.floor(BOSS_BASE_HP * level * (0.8 + Math.random() * 0.4));
  db.run(`INSERT INTO world_boss (boss_id, species, rarity, hp, max_hp, level, pot, ends_at) VALUES ('${guildId}', '${species}', '${rarity}', ${hp}, ${hp}, ${level}, 0, ${Math.floor(Date.now() / 1000) + BOSS_LIFE})`);
  save();
  return { boss_id: guildId, species, rarity, hp, max_hp: hp, level, pot: 0, ends_at: Math.floor(Date.now() / 1000) + BOSS_LIFE };
}

function attackBoss(guildId, userId, damage) {
  const boss = getBoss(guildId);
  if (!boss) return { ok: false, reason: 'noboss' };
  if (Math.floor(Date.now() / 1000) > boss.ends_at) return { ok: false, reason: 'expired' };
  db.run(`UPDATE world_boss SET hp = hp - ${damage} WHERE boss_id = '${guildId}'`);
  const rows = db.exec(`SELECT damage FROM boss_contrib WHERE boss_id = '${guildId}' AND user_id = '${userId}'`);
  if (rows.length && rows[0].values.length) {
    db.run(`UPDATE boss_contrib SET damage = damage + ${damage} WHERE boss_id = '${guildId}' AND user_id = '${userId}'`);
  } else {
    db.run(`INSERT INTO boss_contrib (boss_id, user_id, damage) VALUES ('${guildId}', '${userId}', ${damage})`);
  }
  save();
  return { ok: true, hp: boss.hp - damage, max_hp: boss.max_hp, boss_id: guildId };
}

function addBossPot(guildId, amount) {
  const boss = getBoss(guildId);
  if (!boss) return false;
  db.run(`UPDATE world_boss SET pot = pot + ${amount} WHERE boss_id = '${guildId}'`);
  save();
  return true;
}

function getBossContrib(guildId) {
  const rows = db.exec(`SELECT user_id, damage FROM boss_contrib WHERE boss_id = '${guildId}' ORDER BY damage DESC`);
  if (!rows.length) return [];
  return rows[0].values.map(v => ({ user_id: v[0], damage: v[1] }));
}

function resolveBoss(guildId) {
  const rows = db.exec(`SELECT * FROM world_boss WHERE boss_id = '${guildId}'`);
  const contrib = getBossContrib(guildId);
  const boss = rows.length && rows[0].values.length
    ? { boss_id: rows[0].values[0][0], species: rows[0].values[0][1], rarity: rows[0].values[0][2], hp: rows[0].values[0][3], max_hp: rows[0].values[0][4], pot: rows[0].values[0][5], ends_at: rows[0].values[0][6], level: rows[0].values[0][7] }
    : null;
  db.run(`DELETE FROM world_boss WHERE boss_id = '${guildId}'`);
  db.run(`DELETE FROM boss_contrib WHERE boss_id = '${guildId}'`);
  save();
  if (!boss || !contrib.length) return null;
  const payouts = distributeBossPot(guildId, contrib, boss.pot);
  return { payouts, pot: boss.pot, species: boss.species, hp: boss.hp, max_hp: boss.max_hp };
}

function distributeBossPot(guildId, contrib, pot) {
  const totalDamage = contrib.reduce((s, c) => s + c.damage, 0);
  if (totalDamage <= 0) return [];
  const payouts = [];
  for (const c of contrib) {
    const share = Math.floor(pot * (c.damage / totalDamage));
    if (share > 0) { addBalance(c.user_id, share); payouts.push({ user_id: c.user_id, damage: c.damage, share }); }
  }
  return payouts;
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
  getStreak, claimStreak, STREAK_BASE, STREAK_MAX_DAY,
  claimPray,
  getCooldown,
  addGambled,
  addWon,
  getTop,
  getGamblers,
  getAllUsers,
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
  disableChannelCommand,
  enableChannelCommand,
  getChannelDisabled,
  setPendingBattle,
  getPendingBattle,
  deletePendingBattle,
  cleanupPendingBattles,
  repairNaNBalances,
  createGiveaway, getGiveaway, getExpiredGiveaways, addGiveawayEntry, finishGiveaway,
  toggleLucky,
  toggleInsurance,
  setLogChannel,
  getLogChannel,
  setCmdLogChannel, getCmdLogChannel,
  setUpdateChannel, getUpdateChannel, getAllUpdateChannels,
  setEventChannel, getEventChannel, getAllEventChannels,
  getInsuranceRefund,
  addBattleWin, getBattleWins,
  getMaxBet,
  parseBet,
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
  setCustomRoleColor, getGradientCustomRoles,
  getBalanceFactor,
  mergeUser,
  payWin,
  xpForLevel, levelInfo, grantXp,
  bankDeposit, bankWithdraw, adminBankRemove, takeLoan,   payLoan, LOAN_INTEREST, MAX_LOAN_MULT,
  sharkLoan, SHARK_INTEREST, SHARK_MAX, getLoan, hasOutstandingLoan,
  stockPrice, getStockPrices, buyStock, sellStock, getStockShares, getPortfolio, STOCKS,
  rollEggDrop, getEggs, addEgg, hatchEgg, transferAnimal, EGG_DROP_CHANCE, EGG_HATCH_RARITY,
  getQuest, addQuestProgress, claimQuest, getBounty, addBountyProgress, claimBounty,
  getChecklist, addChecklistProgress, claimChecklist, getSeals, addSeals,
  currentSeason, addPassXp, passProgress, buyPassPremium, claimPassLevel, claimAllPass, passTop, passReward,
  PASS_MAX_LEVEL, PASS_DURATION, PASS_PREM_COST, PASS_XP,
  createPvpBounty, getPvpBounty, listActiveBounties, getPvpBountyBetween, recordPvpDuelWin, cancelPvpBounty, pruneExpiredBounties, PVP_BOUNTY_LIFETIME,
  wipeUser,
  currentLbWeek, getWeeklyLb, finalizeWeeklyLb, getLbState, setLbState, setLbChannel, getAllLbChannels, WEEKLY_LB_REWARDS,
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
  FREE_BET_DAILY, FREE_BET_MAX, getFreeBet, claimFreeBet, useFreeBet, addFreeBet,
  registerLoss, resetLossStreak, lossStreakBonus, LOSS_STREAK_WINDOW,
  VAULT_HOURLY_RATE, accrueVaultInterest,
  PET_ACHIEVEMENTS, petAchievementsFor, awardPetAchievement, getPetAchievementReward,
  EVOLUTION_COSTS, EVOLUTION_MIN_LEVEL, canEvolve, evolveAnimal,
  FEED_COST, FEED_DURATION, isFed, feedAnimal,
  FUSION_COST, fuseAnimals,
  ZOO_DECOR, getZooDecors, buyZooDecor,
  EVENT_TYPES, getActiveEvent, startRandomEvent, eventMult, applyRain,
  getNextMerchantArrival, refreshMerchant, getMerchantItems, buyMerchantItem,
  PLOT_BASE_PRICE, PLOT_UPGRADE_COST, PLOT_INCOME_PER_HOUR, PLOT_MAX_LEVEL, getPlot, buyPlot, upgradePlot, claimPlot,
  CLAN_CREATE_COST, CLAN_MAX_MEMBERS, getClan, createClan, getClanMembers, getClanOf, findClanByName, clanJoin, clanLeave, clanKick, clanDeposit, clanWithdraw, deleteClan, getClanTop,
  CLAN_WAR_MIN, CLAN_WAR_MAX_PCT, startClanWar, acceptClanWar, declineClanWar, clanWarFight, getClanWar, getOpenClanWars, getClanWarFighters, setClanWarMsg, resolveClanWars,
  createAuction, getAuction, listAuctions, placeBid, endAuction, cancelAuction, cleanupExpiredAuctions,
  BOSS_BASE_HP, BOSS_LIFE, getBoss, spawnBoss, attackBoss, addBossPot, getBossContrib, resolveBoss,
  CRATES, getCratePity, setCratePity, rollCrateRarity, openCrate,
   isMarried, marriedMult,
   SHINY_CHANCE, PERSONALITIES, rollShiny, rollTrait,
   exec: (sql) => db ? db.exec(sql) : null,
};
