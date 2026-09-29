const db = require('../db');
const { embed } = require('../utils/embed');
const { localMemberIds } = require('../utils/serverAccess');
const config = require('../config');

module.exports = {
  name: 'glb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'best gamblers leaderboard — highest total gambled (shows only this server in a local-only server)',
  aliases: ['gamblelb', 'gamblers'],
  async execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    let top = db.getGamblers(limit * 4);
    const localIds = await localMemberIds(message);
    if (localIds) {
      top = top.filter(u => localIds.has(u.user_id)).slice(0, limit);
    } else {
      top = top.slice(0, limit);
    }

    if (!top.length) return message.channel.send({ embeds: [embed('🎲 Gamblers Leaderboard', [['info', 'no data yet']])] });

    const lines = top.map((u, i) => `**#${i + 1}** <@${u.user_id}> — gambled **${Number(u.total_gambled).toLocaleString()}** ${config.currency}`);
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    const title = localIds ? `🎲 Local Gamblers — ${message.guild.name}` : '🎲 Gamblers Leaderboard';
    message.channel.send({
      embeds: [embed(title, chunks.map(c => ['', c]))],
    });
  },
};
