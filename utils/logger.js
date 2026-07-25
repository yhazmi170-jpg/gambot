const { embed } = require('./embed');
let client = null;

function setClient(c) { client = c; }

function log(guildId, title, fields, color) {
  if (!client) return;
  const channelId = require('../db').getLogChannel(guildId || '');
  if (!channelId) return;
  const channel = client.channels.cache.get(channelId);
  if (channel) channel.send({ embeds: [embed(title, fields, color || 0x2b2d31)] }).catch(() => {});
}

function logGlobal(title, fields, color) {
  if (!client) return;
  for (const guild of client.guilds.cache.values()) {
    log(guild.id, title, fields, color);
  }
}

module.exports = { setClient, log, logGlobal };
