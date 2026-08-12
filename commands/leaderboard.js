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
    const top = db.getTop(limit, null); // null = include everyone (owner too)
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

module.exports.slb = {
  name: 'slb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'server leaderboard — richest players in this server',
  aliases: ['serverlb', 'local'],
  execute(message, args) {
    if (!message.guild) return message.channel.send({ embeds: [require('../utils/embed').error('this only works in servers')] });
    const limit = Math.min(parseInt(args[0]) || 10, 20);

    // Get members of this server
    const memberIds = message.guild.members.cache.map(m => m.id);
    const allUsers = db.getAllUsers ? db.getAllUsers() : [];
    const serverUsers = allUsers.filter(u => memberIds.includes(u.user_id));

    // Sort by total wealth (wallet + bank)
    const sorted = serverUsers.sort((a, b) => ((b.balance + (b.bank || 0)) - (a.balance + (a.bank || 0)))).slice(0, limit);

    if (!sorted.length) return message.channel.send({ embeds: [embed('🏆 Server Leaderboard', [['info', 'no users yet']])] });

    const lines = sorted.map((u, i) => {
      const lb = db.hasPerk(u.user_id, 'colored_lb') ? db.getLbEmoji(u.user_id) + ' ' : '';
      const badge = db.hasPerk(u.user_id, 'badge') ? db.getBadgeEmoji(u.user_id) + ' ' : '';
      return `${lb}${badge}**#${i + 1}** <@${u.user_id}> — **${(u.balance + (u.bank || 0)).toLocaleString()}** ${config.currency}`;
    });
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    message.channel.send({
      embeds: [embed(`🏆 Server Leaderboard — ${message.guild.name}`, chunks.map(c => ['', c]))],
    });
  },
};

module.exports.glb = {
  name: 'glb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'best gamblers leaderboard — highest total gambled',
  aliases: ['gamblelb', 'gamblers'],
  execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    const top = db.getGamblers ? db.getGamblers(limit) : [];

    if (!top.length) return message.channel.send({ embeds: [embed('🎲 Gamblers Leaderboard', [['info', 'no data yet']])] });

    const lines = top.map((u, i) => {
      return `**#${i + 1}** <@${u.user_id}> — gambled **${Number(u.total_gambled).toLocaleString()}** ${config.currency}`;
    });
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    message.channel.send({
      embeds: [embed('🎲 Gamblers Leaderboard', chunks.map(c => ['', c]))],
    });
  },
};
