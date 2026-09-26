const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

function rankLines(items, fmt, excludeId) {
  return items
    .filter(u => u.user_id !== excludeId)
    .map((u, i) => fmt(u, i));
}

function chunkLines(lines) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += 10) {
    chunks.push(lines.slice(i, i + 10).join('\n'));
  }
  return chunks.length ? chunks.map(c => ['', c]) : [['', '']];
}

module.exports = {
  name: 'activity',
  helpCategory: 'Economy',
  helpArgs: '[usage|gamble|wins|commands|summary]',
  description: 'usage analytics — who uses the bot the most, who gambles/wins the most',
  aliases: ['usage', 'analytics'],
  execute(message, args) {
    const sub = (args[0] || '').toLowerCase();
    const owner = config.ownerId;

    if (sub === 'gamble' || sub === 'gambled' || sub === 'gamblers' || sub === 'gamblelb') {
      const top = db.getGamblers(20);
      if (!top.length) return message.channel.send({ embeds: [embed('🎲 Most Gambled', [['info', 'no gambling recorded yet']])] });
      const lines = rankLines(top, (u, i) => `**#${i + 1}** <@${u.user_id}> — **${Number(u.total_gambled).toLocaleString()}** ${config.currency} wagered`, owner);
      return message.channel.send({ embeds: [embed('🎲 Most Gambled', chunkLines(lines))] });
    }

    if (sub === 'win' || sub === 'wins' || sub === 'won' || sub === 'winners') {
      const top = db.getTopWinners(20, owner);
      if (!top.length) return message.channel.send({ embeds: [embed('💰 Most Won', [['info', 'no wins recorded yet']])] });
      const lines = top.map((u, i) => `**#${i + 1}** <@${u.user_id}> — won **${Number(u.total_won).toLocaleString()}** ${config.currency}`);
      return message.channel.send({ embeds: [embed('💰 Most Won', chunkLines(lines))] });
    }

    if (sub === 'commands' || sub === 'cmd' || sub === 'cmds' || sub === 'used') {
      const top = db.getMostUsedCommands(20);
      if (!top.length) return message.channel.send({ embeds: [embed('⚙️ Most Used Commands', [['info', 'no usage recorded yet']])] });
      const lines = top.map((u, i) => `**#${i + 1}** \`${u.feature}\` — **${Number(u.total).toLocaleString()}** uses across **${u.users}** users`);
      return message.channel.send({ embeds: [embed('⚙️ Most Used Commands', chunkLines(lines))] });
    }

    if (sub === 'users' || sub === 'active' || sub === 'mostactive') {
      const top = db.getTopCommandUsers(20, owner);
      if (!top.length) return message.channel.send({ embeds: [embed('👥 Most Active Users', [['info', 'no usage recorded yet']])] });
      const lines = top.map((u, i) => `**#${i + 1}** <@${u.user_id}> — **${Number(u.total).toLocaleString()}** commands · **${u.features}** features`);
      return message.channel.send({ embeds: [embed('👥 Most Active Users', chunkLines(lines))] });
    }

    // default: overall summary
    const s = db.getActivitySummary();
    const topUsers = db.getTopCommandUsers(6, owner);
    const topGamblers = db.getGamblers(5).filter(u => u.user_id !== owner);
    const topWinners = db.getTopWinners(5, owner);

    const fields = [];
    if (s) {
      fields.push(['📊 Bot Activity', `**${Number(s.active_day).toLocaleString()}** active today · **${Number(s.active_week).toLocaleString()}** this week · **${Number(s.total_commands).toLocaleString()}** commands all-time · **${Number(s.total_users).toLocaleString()}** users`, false]);
    }
    if (topUsers.length) {
      fields.push(['👥 Most Used Bot', topUsers.map((u, i) => `**#${i + 1}** <@${u.user_id}> — **${Number(u.total).toLocaleString()}** cmds`).join('\n'), true]);
    }
    if (topGamblers.length) {
      fields.push(['🎲 Most Gambled', topGamblers.map((u, i) => `**#${i + 1}** <@${u.user_id}> — **${Number(u.total_gambled).toLocaleString()}**`).join('\n'), true]);
    }
    if (topWinners.length) {
      fields.push(['💰 Most Won', topWinners.map((u, i) => `**#${i + 1}** <@${u.user_id}> — **${Number(u.total_won).toLocaleString()}**`).join('\n'), true]);
    }
    fields.push(['', 'details: `v activity usage|gamble|wins|commands`', false]);

    message.channel.send({ embeds: [embed('📈 Bot Usage Analytics', fields, 0x2b2d31)] });
  },
};