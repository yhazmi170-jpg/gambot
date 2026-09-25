const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'slb',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'server leaderboard — richest players in this server',
  aliases: ['serverlb', 'local'],
  async execute(message, args) {
    if (!message.guild) return message.channel.send({ embeds: [error('this only works in servers')] });
    const limit = Math.min(parseInt(args[0]) || 10, 20);

    // Get this server's real member list. The in-memory members cache is often
    // incomplete (no GuildMembers intent / large servers), so fetch on demand —
    // but only count users that have actually joined THIS guild.
    let memberIds;
    try {
      const members = await message.guild.members.fetch();
      memberIds = members.map(m => m.id);
    } catch (err) {
      // fall back to whatever is already cached if the fetch fails
      console.error(`[slb] member fetch failed in ${message.guild.id}:`, err && err.message);
      memberIds = message.guild.members.cache.map(m => m.id);
    }

    const allUsers = db.getAllUsers();
    const serverUsers = allUsers.filter(u => memberIds.includes(u.user_id));
    const wealth = u => (u.balance || 0) + (u.bank || 0) + (u.pending_inbox || 0);

    // Sort by total wealth (wallet + bank + unclaimed inbox money)
    const sorted = serverUsers.sort((a, b) => wealth(b) - wealth(a)).slice(0, limit);

    if (!sorted.length) return message.channel.send({ embeds: [embed('🏆 Server Leaderboard', [['info', 'no users yet']])] });

    const lines = sorted.map((u, i) => `**#${i + 1}** <@${u.user_id}> — **${wealth(u).toLocaleString()}** ${config.currency}`);
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join('\n'));
    }

    message.channel.send({
      embeds: [embed(`🏆 Server Leaderboard — ${message.guild.name}`, chunks.map(c => ['', c]))],
    });
  },
};
