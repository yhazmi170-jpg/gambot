const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'slb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'server leaderboard — richest players in this server',
  aliases: ['serverlb', 'local'],
  execute(message, args) {
    if (!message.guild) return message.channel.send({ embeds: [error('this only works in servers')] });
    const limit = Math.min(parseInt(args[0]) || 10, 20);

    // Get members of this server
    const memberIds = message.guild.members.cache.map(m => m.id);
    const allUsers = db.getAllUsers();
    const serverUsers = allUsers.filter(u => memberIds.includes(u.user_id));

    // Sort by total wealth (wallet + bank)
    const sorted = serverUsers.sort((a, b) => ((b.balance + (b.bank || 0)) - (a.balance + (a.bank || 0)))).slice(0, limit);

    if (!sorted.length) return message.channel.send({ embeds: [embed('🏆 Server Leaderboard', [['info', 'no users yet']])] });

    const lines = sorted.map((u, i) => `**#${i + 1}** <@${u.user_id}> — **${(u.balance + (u.bank || 0)).toLocaleString()}** ${config.currency}`);
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    message.channel.send({
      embeds: [embed(`🏆 Server Leaderboard — ${message.guild.name}`, chunks.map(c => ['', c]))],
    });
  },
};
