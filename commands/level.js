const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'level',
  helpCategory: 'Economy',
  helpArgs: '',
  aliases: ['lvl', 'xp'],
  description: 'check your level and progress',
  execute(message, args) {
    const uid = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
    const u = db.ensureUser(uid);
    if (!u) return message.channel.send({ embeds: [require('../utils/embed').error('user not found')] });

    const info = db.levelInfo(uid);
    const pct = Math.floor(info.progress * 100);
    const barLen = 10;
    const filled = Math.floor((info.progress) * barLen);
    const bar = '▰'.repeat(filled) + '▱'.repeat(barLen - filled);
    const next = db.xpForLevel(info.level);

    const reward = Math.floor(1000 * (info.level + 1) * db.getBalanceFactor(uid));

    message.channel.send({
      embeds: [embed('⬆️ Level', [
        [`<@${uid}>`, `**Level ${info.level}**`],
        ['Progress', `${bar} \`${info.xp}/${next} XP\` (${pct}%)`],
        ['Next reward', `level up → **${reward.toLocaleString()}** money`],
      ], 0x57f287)],
    });
  },
};
