const db = require('../db');
const { embed } = require('../utils/embed');
const { visibleUserFilter } = require('../utils/serverAccess');
const config = require('../config');

module.exports = {
  name: 'glb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'best gamblers leaderboard — highest total gambled (local-only servers show only their own, and never show elsewhere)',
  aliases: ['gamblelb', 'gamblers'],
  async execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    const filter = await visibleUserFilter(message);
    let top = db.getGamblers(filter ? limit * 8 : limit);
    if (filter) {
      top = top.filter(u => filter.test(u.user_id)).slice(0, limit);
    }
    const isLocal = filter && filter.mode === 'local';

    if (!top.length) return message.channel.send({ embeds: [embed('🎲 Gamblers Leaderboard', [['info', 'no data yet']])] });

    const lines = top.map((u, i) => `**#${i + 1}** <@${u.user_id}> — gambled **${Number(u.total_gambled).toLocaleString()}** ${config.currency}`);
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    const title = isLocal ? `🎲 Local Gamblers — ${message.guild.name}` : '🎲 Gamblers Leaderboard';
    message.channel.send({
      embeds: [embed(title, chunks.map(c => ['', c]))],
    });
  },
};
