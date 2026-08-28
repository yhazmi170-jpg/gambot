const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'lb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'global leaderboard — richest players (wallet + bank)',
  aliases: ['top', 'rich'],
  execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    const top = db.getTop(limit, config.ownerId);
    if (!top.length) return message.channel.send({ embeds: [embed('🏆 Global Leaderboard', [['info', 'no users yet']])] });

    const lines = top.map((u, i) => {
      const lb = db.hasPerk(u.user_id, 'colored_lb') ? db.getLbEmoji(u.user_id) + ' ' : '';
      const badge = db.hasPerk(u.user_id, 'badge') ? db.getBadgeEmoji(u.user_id) + ' ' : '';
      return `${lb}${badge}**#${i + 1}** <@${u.user_id}> — **${u.balance.toLocaleString()}** ${config.currency}`;
    });
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    message.channel.send({
      embeds: [embed('🏆 Global Leaderboard', chunks.map(c => ['', c]))],
    });
  },
};


