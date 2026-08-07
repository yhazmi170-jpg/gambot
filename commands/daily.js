const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'daily',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'claim daily reward (high bal = slightly less)',
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
    const factor = db.getBalanceFactor(message.author.id);
    const married = info.mult > 1;
    const finalReward = Math.floor(info.reward * factor);
    const diff = finalReward - info.reward;
    if (diff !== 0) db.addBalance(message.author.id, diff);
    message.channel.send({
      embeds: [embed('🎁 Daily', [
        ['Reward', `**${finalReward}** ${config.currency}${married ? ' (❤️ married +10%)' : ''}${factor < 1 ? ` (${Math.round((1 - factor) * 100)}% reduction)` : ''}`],
        ['Streak', `day **${info.streak}**`],
        ['Next', info.reward >= info.max ? 'max streak reached!' : `+500 per day (max ${info.max})`],
      ])],
    });
  },
};
