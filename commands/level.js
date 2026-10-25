const { EmbedBuilder } = require('discord.js');
const db = require('../db');
const { error } = require('../utils/embed');

module.exports = {
  name: 'level',
  helpCategory: 'Economy',
  helpArgs: '[user]',
  aliases: ['lvl', 'xp'],
  description: 'check your level and progress',
  async execute(message, args) {
    let target = message.author;
    if (message.mentions?.users?.first && message.mentions.users.first()) {
      target = message.mentions.users.first();
    } else if (args[0]) {
      const cleanId = args[0].replace(/[<@!>]/g, '');
      const fetched = await message.client?.users?.fetch(cleanId).catch(() => null);
      if (fetched) target = fetched;
    }

    const uid = target.id;
    const u = db.ensureUser(uid);
    if (!u) return message.channel.send({ embeds: [error('user not found')] });

    const info = db.levelInfo(uid);
    const next = db.xpForLevel(info.level);
    const rank = db.getLevelRank ? db.getLevelRank(uid) : 1;
    const pct = Math.floor(info.progress * 100);
    const barLen = 12;
    const filled = Math.max(0, Math.min(barLen, Math.floor(info.progress * barLen)));
    const bar = '▰'.repeat(filled) + '▱'.repeat(barLen - filled);
    const reward = Math.floor(1000 * (info.level + 1) * db.getBalanceFactor(uid));

    let title = 'A Gambot User';
    const eq = db.getEquippedTitle ? db.getEquippedTitle(uid) : null;
    if (eq && db.TITLES && db.TITLES[eq]) {
      title = db.TITLES[eq].name;
    }

    const avatarUrl = target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true, size: 256 }) : null;

    const levelEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: target.username, iconURL: avatarUrl || undefined })
      .setTitle(`Level ${info.level} • Rank #${rank}`)
      .setDescription(
        `**${title}**\n\n` +
        `**Progress**\n` +
        `${bar} \`${info.xp.toLocaleString()}/${next.toLocaleString()} XP\` (${pct}%)\n\n` +
        `**Next Level Reward**\n` +
        `**+${reward.toLocaleString()}** money`
      )
      .setThumbnail(avatarUrl || null)
      .setFooter({ text: `Gambot Progression • Rank #${rank}` });

    message.channel.send({ embeds: [levelEmbed] });
  },
};
