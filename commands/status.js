const config = require('../config');
const db = require('../db');
const runtime = require('../utils/runtime');
const { embed } = require('../utils/embed');

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

// v status — which instance am I talking to? Every running copy of the bot has its
// OWN boot_id + hostname, so if two different copies answer, the boards go double.
// Run this in any server to see the exact host/commit serving you.
module.exports = {
  name: 'status',
  helpCategory: 'Info',
  helpArgs: '',
  description: 'show which bot instance is running (boot id, host, commit, uptime) — use it to spot double-replying copies',
  aliases: ['botstatus', 'instancestatus', 'whichbot', 'uptime'],
  execute(message) {
    const f = runtime.fields();
    let guilds = 'unknown';
    try { guilds = message.client && message.client.guilds ? message.client.guilds.cache.size : 'unknown'; } catch (e) { /* ignore */ }
    let listeners = 'unknown';
    try { listeners = message.client && message.client.eventNames ? message.client.eventNames().filter(e => e === 'messageCreate').length : 'unknown'; } catch (e) { /* ignore */ }
    const sameServer = message.guild && message.client && message.client.guilds
      && message.client.guilds.cache.get(message.guild.id);
    return message.channel.send({ embeds: [embed('📡 Bot instance', [
      ['boot id', `\`${f.boot_short}\``],
      ['commit', `\`${String(f.commit).slice(0, 7)}\``],
      ['version', `v${f.version}`],
      ['uptime', fmtUptime(runtime.uptimeMs())],
      ['started', f.started_at],
      ['host', `\`${f.hostname}\``],
      ['in this server', sameServer ? 'yes' : 'no — you are in a server the bot is NOT in'],
      ['servers', String(guilds)],
      ['message listeners', String(listeners)],
    ], 0x57f287)] });
  },
};
