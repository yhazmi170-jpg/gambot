const db = require('../db');
const { embed } = require('../utils/embed');
const { visibleUserFilter } = require('../utils/serverAccess');
const config = require('../config');

module.exports = {
  name: 'lb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'leaderboard — richest players (wallet + bank + unclaimed inbox); local-only servers show only their own, and their players never show on other servers',
  aliases: ['top', 'rich'],
  async execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    const filter = await visibleUserFilter(message);
    let top = db.getTop(filter ? limit * 8 : limit, config.ownerId); // over-fetch so filtering can't starve the list
    if (filter) {
      top = top.filter(u => filter.test(u.user_id)).slice(0, limit);
    }
    const isLocal = filter && filter.mode === 'local';
    if (!top.length) return message.channel.send({ embeds: [embed(isLocal ? '🏆 Local Leaderboard' : '🏆 Global Leaderboard', [['info', 'no users yet']])] });

    const lines = top.map((u, i) => {
      const lb = db.hasPerk(u.user_id, 'colored_lb') ? db.getLbEmoji(u.user_id) + ' ' : '';
      const badge = db.hasPerk(u.user_id, 'badge') ? db.getBadgeEmoji(u.user_id) + ' ' : '';
      return `${lb}${badge}**#${i + 1}** <@${u.user_id}> — **${u.balance.toLocaleString()}** ${config.currency}`;
    });
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    const title = isLocal ? `🏆 Local Leaderboard — ${message.guild.name}` : '🏆 Global Leaderboard';
    message.channel.send({
      embeds: [embed(title, chunks.map(c => ['', c]))],
    });
  },
};


