// "JayJay made this" — the owner's unstoppable credit (2026-10-06).
// Two paths, both random and both free-running forever:
//   1. COMMAND: ~1 in 50 command replies is followed by a plain `JayJay made this`
//      message that the bot then reacts to with 😭 (Discord emoji name `sob`).
//   2. PASSIVE CHAT: every 60–180 min the bot drops the same line in a random
//      text channel of a random ACTIVE server (server gate respected) + the 😭.
// Gate: every test points DB_PATH at a /tmp throwaway DB, so the credit is OFF
// there — no existing assertion can ever see an extra reply. GAMBOT_CREDIT
// overrides for every case: off | on | force (force = every command credits).
// Per-server off switch: `Aovo jayjay off` stores a credit_guilds row — that
// server is then skipped by BOTH paths (see db.isCreditGuildEnabled).
const crypto = require('crypto');
const db = require('../db');

const CREDIT_TEXT = 'JayJay made this';
const SOB = '😭'; // discord emoji name: sob
const COMMAND_CHANCE = 50;            // 1 in 50 commands
const MIN_GAP_MS = 60 * 60 * 1000;    // passive: 60..
const MAX_GAP_MS = 180 * 60 * 1000;   // passive: ..180 min

// ON by default (production runs DB_PATH=./data); OFF only when DB_PATH points at
// a /tmp throwaway, which every single test script sets — so tests stay deterministic.
function isTestPath() {
  return (process.env.DB_PATH || '').includes('/tmp');
}

function override() {
  return (process.env.GAMBOT_CREDIT || '').toLowerCase();
}

function isEnabled() {
  const o = override();
  if (o === 'off' || o === '0' || o === 'false') return false;
  if (o === 'on' || o === '1' || o === 'true' || o === 'force') return true;
  return !isTestPath(); // production path (./data …) only
}

function roll() {
  if (override() === 'force') return true;
  return crypto.randomInt(COMMAND_CHANCE) === 0;
}

function pickDelay() {
  return MIN_GAP_MS + crypto.randomInt(MAX_GAP_MS - MIN_GAP_MS + 1);
}

// called from utils/commandHandler.js right after a command executes
async function maybeCommandCredit(message) {
  try {
    if (!isEnabled()) return false;
    // per-server off switch (`Aovo jayjay off`) — checked BEFORE the roll so a
    // disabled server can never burn the roll or emit a stray line
    if (message.guild && message.guild.id && !db.isCreditGuildEnabled(message.guild.id)) return false;
    if (!roll()) return false;
    const sent = await message.reply({ content: CREDIT_TEXT, allowedMentions: { repliedUser: false } });
    if (sent && typeof sent.react === 'function') await sent.react(SOB).catch(() => {});
    console.log(`[CREDIT] command credit msg=${message.id} user=${message.author && message.author.id} reply=${sent && sent.id}`);
    return true;
  } catch (e) {
    return false;
  }
}

let passiveStarted = null;

// called once from index.js on gateway ready. Returns a handle (or null when off).
function startPassive(client, opts = {}) {
  try {
    if (passiveStarted && !opts.fresh) return passiveStarted;
    if (!opts.force && !isEnabled()) return null;
    if (!client || !client.guilds || typeof client.guilds.cache === 'undefined') return null;

    let stopped = false;
    let timer = null;

    const drop = async () => {
      try {
        const guilds = [];
        for (const g of client.guilds.cache.values()) {
          let active = true;
          try { active = db.isServerActive(g.id); } catch (e) { active = true; }
          let creditOn = true;
          try { creditOn = db.isCreditGuildEnabled(g.id); } catch (e) { creditOn = true; }
          if (active && creditOn) guilds.push(g);
        }
        if (guilds.length) {
          const g = guilds[crypto.randomInt(guilds.length)];
          const chans = [];
          for (const c of (g.channels && g.channels.cache ? g.channels.cache.values() : [])) {
            if (!c || c.type !== 0 || typeof c.send !== 'function') continue;
            try {
              const me = g.members && g.members.me;
              const perms = (me && c.permissionsFor) ? c.permissionsFor(me) : null;
              if (perms && perms.has && !perms.has('SendMessages')) continue;
            } catch (e) { /* unknown perms — try sending anyway */ }
            chans.push(c);
          }
          if (chans.length) {
            const ch = chans[crypto.randomInt(chans.length)];
            const sent = await ch.send(CREDIT_TEXT);
            if (sent && typeof sent.react === 'function') await sent.react(SOB).catch(() => {});
            console.log(`[CREDIT] passive drop guild=${g.id} channel=${ch.id} msg=${sent && sent.id}`);
          }
        }
      } catch (e) { /* a credit failure must never crash the bot */ }
      if (!stopped) timer = setTimeout(drop, opts.delayMs || pickDelay());
    };

    const firstIn = opts.delayMs != null ? opts.delayMs : pickDelay();
    console.log(`[CREDIT] passive credit armed — first drop in ${Math.round(firstIn / 60000)} min (enabled=1)`);
    timer = setTimeout(drop, firstIn);
    passiveStarted = { stop() { stopped = true; clearTimeout(timer); } };
    return passiveStarted;
  } catch (e) {
    return null;
  }
}

module.exports = {
  CREDIT_TEXT,
  SOB,
  COMMAND_CHANCE,
  isEnabled,
  roll,
  pickDelay,
  maybeCommandCredit,
  startPassive,
  // test-only: reset the one-shot passive guard
  _reset() { passiveStarted = null; },
};
