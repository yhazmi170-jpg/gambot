const { embed } = require('./embed');
let client = null;

function setClient(c) { client = c; }

function sendTo(channelId, title, fields, color) {
  if (!client || !channelId) return;
  const channel = client.channels.cache.get(channelId);
  if (channel) channel.send({ embeds: [embed(title, fields, color || 0x2b2d31)] }).catch(() => {});
}

function log(guildId, title, fields, color) {
  const channelId = require('../db').getLogChannel(guildId || '');
  sendTo(channelId, title, fields, color);
}

function logCmd(guildId, title, fields, color) {
  const channelId = require('../db').getCmdLogChannel(guildId || '');
  sendTo(channelId, title, fields, color);
}

function logGlobal(title, fields, color) {
  if (!client) return;
  for (const guild of client.guilds.cache.values()) {
    log(guild.id, title, fields, color);
  }
}

module.exports = { setClient, log, logCmd, logGlobal };