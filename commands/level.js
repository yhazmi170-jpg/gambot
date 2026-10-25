const { AttachmentBuilder } = require('discord.js');
const db = require('../db');
const { error } = require('../utils/embed');
const { generateLevelCard } = require('../utils/levelCard');

module.exports = {
  name: 'level',
  helpCategory: 'Economy',
  helpArgs: '[user]',
  aliases: ['lvl', 'xp'],
  description: 'check your level and progress banner',
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

    let title = 'A Gambot User';
    const eq = db.getEquippedTitle ? db.getEquippedTitle(uid) : null;
    if (eq && db.TITLES && db.TITLES[eq]) {
      title = db.TITLES[eq].name;
    }

    const avatarUrl = target.displayAvatarURL ? target.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 }) : null;

    try {
      const buffer = await generateLevelCard({
        username: target.username,
        title,
        level: info.level,
        rank,
        xp: info.xp,
        needed: next,
        progress: info.progress,
        avatarUrl,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'level.png' });
      await message.channel.send({ files: [attachment] });
    } catch (err) {
      console.error('[level] Error generating level card:', err);
      const reward = Math.floor(1000 * (info.level + 1) * db.getBalanceFactor(uid));
      message.channel.send({
        content: `**${target.username}** • Level ${info.level} • XP: ${info.xp.toLocaleString()}/${next.toLocaleString()} • Next reward: ${reward.toLocaleString()} money`,
      });
    }
  },
};
