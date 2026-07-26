const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'daily',
  helpCategory: 'Economy',
  helpArgs: '',
  aliases: ['dailies'],
  execute(message, args) {
    const user = db.ensureUser(message.author.id);
    const cooldown = db.getCooldown(user.daily_time, 86400);
    if (cooldown > 0) {
      const h = Math.floor(cooldown / 3600);
      const m = Math.floor((cooldown % 3600) / 60);
      return message.channel.send({ embeds: [error(`daily already claimed. come back in ${h}h ${m}m`)] });
    }

    const info = db.claimDaily(message.author.id);
    message.channel.send({
      embeds: [embed('☀️ Daily', [
        ['Reward', `**${info.reward}** ${config.currency}`],
        ['Streak', `day **${info.streak}**`],
        ['Next', info.reward >= info.max ? 'max streak reached!' : `+500 per day (max ${info.max})`],
      ])],
    });
  },
};
