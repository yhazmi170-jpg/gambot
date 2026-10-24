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
    const rewardMult = db.eventMult('rewardMult');
    const finalReward = Math.floor(info.reward * factor * rewardMult);
    const diff = finalReward - info.reward;
    if (diff !== 0) db.addBalance(message.author.id, diff);
    const avatarUrl = message.author.displayAvatarURL ? message.author.displayAvatarURL({ dynamic: true }) : null;
    message.channel.send({
      embeds: [embed('Daily Reward', [
        ['Claimed', `**+${finalReward.toLocaleString()}** ${config.currency}${married ? ' (+10% married)' : ''}${factor < 1 ? ` (${Math.round((1 - factor) * 100)}% cut)` : ''}${rewardMult > 1 ? ` (x${rewardMult} event)` : ''}`, true],
        ['Streak', `**${info.streak} Day${info.streak === 1 ? '' : 's'}**`, true],
        ['Progress', info.reward >= info.max ? 'Max streak reached' : `+500/day (cap: ${info.max.toLocaleString()})`, true],
      ], 0x57f287)
      .setAuthor({ name: `${message.author.username}'s Daily Reward`, iconURL: avatarUrl })
      .setFooter({ text: 'Claim every 24h to maintain streak' })],
    });
  },
};
