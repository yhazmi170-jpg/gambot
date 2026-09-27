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

function formatRec(g) {
  const name = g.guildName ? ` — ${g.guildName}` : '';
  const who = g.activatedBy ? ` · by \`${g.activatedBy}\`` : '';
  return `\`${g.guildId}\`${name}${who}`;
}

function listEmbed() {
  const { active, locked, pending } = db.listServerAccess();
  const section = (rows, empty) => (rows.length ? rows.map(formatRec).join('\n') : empty);
  return embed('Servers', [
    ['unlocked (' + active.length + ')', section(active, '_none_')],
    ['locked (' + locked.length + ')', section(locked, '_none_')],
    ['waiting (' + pending.length + ')', section(pending, '_none_')],
  ], 0x57f287);
}

module.exports = { parseGuildId, listEmbed, formatRec };
