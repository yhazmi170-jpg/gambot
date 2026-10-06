let config;
try { config = require('./config.json'); } catch { config = require('./config.example.json'); }
if (process.env.TOKEN) config.token = process.env.TOKEN;
config.selfbotUrl = process.env.SELFBOT_URL || config.selfbotUrl || 'https://discord-selfy.onrender.com';
config.selfbotServiceId = process.env.SELFBOT_SERVICE_ID || config.selfbotServiceId || '';
config.renderApiKey = process.env.RENDER_API_KEY || config.renderApiKey || '';
// Owner-equivalent accounts: the owner PLUS any extra user ids (the owner's alt).
// These get FULL admin parity — the `A` prefix (Aovo add/remove/bal/reward/log/
// announce/restart/shutdown/wipe...), every owner-only command, the disabled-command
// and server-gate bypasses, and `v psu`/`v usp`/`v psu list`.
// Deliberately hardcoded: config.json is gitignored (never shipped, secrets live
// there), so a code constant is the only list that reliably reaches Render.
const OWNER_ALTS = ['1271980182718251196'];
config.owners = Array.from(new Set([String(config.ownerId), ...OWNER_ALTS]));
config.isOwner = (id) => config.owners.includes(String(id));
// DM policy (owner request 2026-10-06): ONLY the main owner is ever DM'd.
// The alt keeps full admin PERMISSIONS (isOwner above) but must never receive a DM.
// Every owner-facing DM path must iterate config.dmOwners, never config.owners.
config.dmOwners = [String(config.ownerId)];
config.isDmOwner = (id) => config.dmOwners.includes(String(id));
// alias kept for readability at server-gate call sites
config.isServerAdmin = config.isOwner;
module.exports = config;
