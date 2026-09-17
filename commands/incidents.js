const db = require('../db');
const { embed, error } = require('../utils/embed');

const TYPE_ICON = {
  achievement: '🏅',
  title: '🎖️',
  event: '📣',
  boss: '🐉',
  giveaway: '🎉',
  summon: '📢',
  creature: '🦄',
  milestone: '⭐',
  discovery: '✨',
  return: '👋',
};

module.exports = {
  name: 'incidents',
  helpCategory: 'Fun',
  helpArgs: '[count]',
  description: 'Gambot server lore — notable things that happened here',
  aliases: ['lore', 'history', 'eventslog'],
  execute(message, args) {
    if (!message.guild) {
      return message.channel.send({ embeds: [error('incidents only record in servers, not DMs')] });
    }
    let limit = parseInt(args[0], 10);
    if (!limit || isNaN(limit)) limit = 8;
    limit = Math.max(1, Math.min(limit, 15));
    const list = db.getIncidents(message.guild.id, limit);
    if (!list.length) {
      return message.channel.send({ embeds: [embed('📜 Server Lore', [['', 'nothing notable has recorded yet — go achieve something chaotic first']], 0x2b2d31)] });
    }
    const lines = list.map(inc => {
      const icon = TYPE_ICON[inc.type] || '·';
      const ago = (() => {
        const sec = Math.floor(Date.now() / 1000 - inc.created_at);
        if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m ago`;
        if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
        return `${Math.floor(sec / 86400)}d ago`;
      })();
      return `${icon} ${inc.text} — ${ago}`;
    });
    message.channel.send({
      embeds: [embed('📜 Server Lore', [['Recent Events', lines.join('\n')], ['', 'lore is stored lightly (60 per server, no message content) and is for fun']], 0x2b2d31)],
    });
  },
};