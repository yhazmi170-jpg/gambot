// Server-gate helpers shared by `v psu` (unlock) and `v usp` (lock).
// Both are owner-only and work from ANY server: no argument means "this server",
// an id means "that server" — so the owner can copy an id out of `v psu list`
// (or out of the server's own settings) and paste it in one message.
const db = require('../db');
const { embed } = require('./embed');

// Accepts a bare snowflake, a backticked `id` straight out of the list, or junk
// with the digits buried in it ("lock 1234 5678 9012 3456 789"). Returns null
// when there is nothing id-shaped in there so the caller can say so cleanly.
function parseGuildId(arg) {
  if (arg === undefined || arg === null) return null;
  const digits = String(arg).replace(/[^0-9]/g, '');
  if (!digits) return null;
  // Discord snowflakes are 17-20 digits; anything else is a typo, not an id
  return digits.length >= 17 && digits.length <= 20 ? digits : null;
}

// Local-only ("offline") servers: leaderboards show ONLY this server's members.
// Returns a Set of member ids to filter by, or null when the guild is global/DM so
// callers keep showing everyone. Reuses slb's on-demand member fetch.
async function localMemberIds(message) {
  if (!message.guild) return null;
  if (!db.isServerOffline(message.guild.id)) return null;
  let members;
  try {
    members = await message.guild.members.fetch();
  } catch (err) {
    console.error(`[local] member fetch failed in ${message.guild.id}:`, err && err.message);
    members = message.guild.members.cache;
  }
  const list = (members && members.values) ? [...members.values()] : (members || []);
  return new Set(list.map(m => m.user ? m.user.id : m.id));
}

// True when this command is running in a local-only server. Commands that are
// global/cross-server BY DESIGN (clans, clanwars — player-based, joinable from any
// server) must not run there because their output would reveal other-server users.
function inLocalOnlyServer(message) {
  return !!(message.guild && db.isServerOffline(message.guild.id));
}

function formatRec(g) {
  const name = g.guildName ? ` — ${g.guildName}` : '';
  const who = g.activatedBy ? ` · by \`${g.activatedBy}\`` : '';
  return `\`${g.guildId}\`${name}${who}`;
}

function listEmbed() {
  const { active, offline, locked, pending } = db.listServerAccess();
  const section = (rows, empty) => (rows.length ? rows.map(formatRec).join('\n') : empty);
  return embed('Servers', [
    ['unlocked — global (' + active.length + ')', section(active, '_none_')],
    ['unlocked — local only (' + offline.length + ')', section(offline, '_none_')],
    ['locked (' + locked.length + ')', section(locked, '_none_')],
    ['waiting (' + pending.length + ')', section(pending, '_none_')],
  ], 0x57f287);
}

module.exports = { parseGuildId, listEmbed, formatRec, localMemberIds, inLocalOnlyServer };
