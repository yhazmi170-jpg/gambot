const db = require('../db');
const { embed } = require('../utils/embed');
const { localMemberIds } = require('../utils/serverAccess');
const config = require('../config');

module.exports = {
  name: 'lb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'leaderboard — richest players (wallet + bank + unclaimed inbox); in a local-only server shows only this server',
  aliases: ['top', 'rich'],
  async execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    let top = db.getTop(limit * 4, config.ownerId); // over-fetch so local filtering can't starve the list
    const localIds = await localMemberIds(message);
    if (localIds) {
      top = top.filter(u => localIds.has(u.user_id)).slice(0, limit);
    } else {
      top = top.slice(0, limit);
    }
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

    const title = localIds ? `🏆 Local Leaderboard — ${message.guild.name}` : '🏆 Global Leaderboard';
    message.channel.send({
      embeds: [embed(title, chunks.map(c => ['', c]))],
    });
  },
};


