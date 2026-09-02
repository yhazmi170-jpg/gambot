const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'pray',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'pray for a blessing (daily streak boosts the reward)',
  aliases: ['bless', 'blessing'],
  execute(message) {
    const info = db.claimPray(message.author.id);

    const lines = [
      ['Blessing', `**${info.reward}** ${config.currency}`],
      ['Streak', `day **${info.streak}** (+${((info.mult - 1) * 100).toFixed(0)}% bonus)`],
    ];

    if (info.factor < 1) {
      lines.push(['Balance Factor', `(${Math.round((1 - info.factor) * 100)}% reduction)`]);
    }

    message.channel.send({
      embeds: [embed('🙏 Pray', lines, 0xfee75c)],
    });
  },
};
