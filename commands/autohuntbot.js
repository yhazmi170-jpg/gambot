const db = require('../db');
const { success, error } = require('../utils/embed');

module.exports = {
  name: 'autohuntbot',
  helpCategory: 'Pets',
  helpArgs: '',
  aliases: ['ahbot', 'autohuntup'],
  description: 'upgrade the autohunt bot with essence (more animals per cycle, longer runs, higher rank)',
  execute(message, args) {
    const userId = message.author.id;
    const user = db.ensureUser(userId);
    const level = user ? user.autohunt_level : 0;
    const cost = db.autohuntUpgradeCost(level);
    const essence = db.getEssence(userId);

    if (essence < cost) {
      return message.channel.send({ embeds: [error(`upgrading the autohunt bot to **level ${level + 1}** costs **${cost}** essence (you have **${essence}**)`)] });
    }

    const r = db.upgradeAutohunt(userId);
    if (!r || !r.ok) return message.channel.send({ embeds: [error(`not enough essence`)] });

    message.channel.send({
      embeds: [success(
        `autohunt bot upgraded to **level ${r.level}** (rank **${db.autohuntRank(r.level)}**)\n` +
        `now hunts **${db.autohuntAnimalsPerCycle(r.level)}** animal(s) per minute · max run **${db.autohuntMaxMinutes(r.level)}m**\n` +
        `next upgrade: **${db.autohuntUpgradeCost(r.level)}** essence\n` +
        `you have **${db.getEssence(userId)}** left`
      )],
    });
  },
};
