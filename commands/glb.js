const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'glb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'best gamblers leaderboard — highest total gambled',
  aliases: ['gamblelb', 'gamblers'],
  execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    const top = db.getGamblers(limit);

    if (!top.length) return message.channel.send({ embeds: [embed('🎲 Gamblers Leaderboard', [['info', 'no data yet']])] });

    const lines = top.map((u, i) => `**#${i + 1}** <@${u.user_id}> — gambled **${Number(u.total_gambled).toLocaleString()}** ${config.currency}`);
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    message.channel.send({
      embeds: [embed('🎲 Gamblers Leaderboard', chunks.map(c => ['', c]))],
    });
  },
};
