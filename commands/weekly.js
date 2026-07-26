const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'weekly',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'claim weekly reward (high bal = slightly less)',
  aliases: ['week'],
  execute(message, args) {
    const user = db.ensureUser(message.author.id);
    const cooldown = db.getCooldown(user.weekly_time, 604800);
    if (cooldown > 0) {
      const d = Math.floor(cooldown / 86400);
      const h = Math.floor((cooldown % 86400) / 3600);
      return message.channel.send({ embeds: [error(`weekly already claimed. come back in ${d}d ${h}h`)] });
    }
    const base = db.hasPerk(message.author.id, 'daily_cap') ? 25000 : config.weeklyAmount;
    const factor = db.getBalanceFactor(message.author.id);
    const amount = Math.floor(base * factor);
    db.claimWeekly(message.author.id, amount);
    message.channel.send({
      embeds: [success(`claimed **${amount}** ${config.currency} as your weekly reward!${base > config.weeklyAmount ? ' (daily cap perk!)' : ''}${factor < 1 ? ` (${Math.round((1 - factor) * 100)}% reduction)` : ''}`)],
    });
  },
};
