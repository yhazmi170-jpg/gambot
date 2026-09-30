const db = require('../db');
const { embed } = require('../utils/embed');
const { visibleUserFilter } = require('../utils/serverAccess');
const config = require('../config');

function rankLines(items, fmt, excludeId) {
  // excludeId may be a single id or a list — every owner-equivalent account
  // (owner + alt) stays off the boards
  const skip = new Set((Array.isArray(excludeId) ? excludeId : [excludeId]).map(String));
  return items
    .filter(u => u.user_id && !skip.has(String(u.user_id)))
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
  description: 'usage analytics — who uses the bot the most, who gambles/wins the most (local-only server shows only its members)',
  aliases: ['usage', 'analytics'],
  async execute(message, args) {
    const sub = (args[0] || '').toLowerCase();
    const owner = config.owners;
    const filter = await visibleUserFilter(message);
    const local = (rows) => (filter ? rows.filter(u => u.user_id && filter.test(u.user_id)) : rows);

    if (sub === 'gamble' || sub === 'gambled' || sub === 'gamblers' || sub === 'gamblelb') {
      const top = local(db.getGamblers(40));
      if (!top.length) return message.channel.send({ embeds: [embed('🎲 Most Gambled', [['info', 'no gambling recorded yet']])] });
      const lines = rankLines(top, (u, i) => `**#${i + 1}** <@${u.user_id}> — **${Number(u.total_gambled).toLocaleString()}** ${config.currency} wagered`, owner);
      return message.channel.send({ embeds: [embed('🎲 Most Gambled', chunkLines(lines))] });
    }

    if (sub === 'win' || sub === 'wins' || sub === 'won' || sub === 'winners') {
      const top = local(db.getTopWinners(40, owner));
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
      const top = local(db.getTopCommandUsers(40, owner));
      if (!top.length) return message.channel.send({ embeds: [embed('👥 Most Active Users', [['info', 'no usage recorded yet']])] });
      const lines = top.map((u, i) => `**#${i + 1}** <@${u.user_id}> — **${Number(u.total).toLocaleString()}** commands · **${u.features}** features`);
      return message.channel.send({ embeds: [embed('👥 Most Active Users', chunkLines(lines))] });
    }

    // default: overall summary
    const s = db.getActivitySummary();
    const topUsers = local(db.getTopCommandUsers(10, owner));
    const topGamblers = local(db.getGamblers(10).filter(u => u.user_id !== owner));
    const topWinners = local(db.getTopWinners(10, owner));

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