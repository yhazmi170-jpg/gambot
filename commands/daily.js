const db = require('../db');
const { embed, error } = require('../utils/embed');
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
    const rewardMult = db.eventMult('rewardMult');
    const finalReward = Math.floor(info.reward * factor * rewardMult);
    const diff = finalReward - info.reward;
    if (diff !== 0) db.addBalance(message.author.id, diff);
    const avatarUrl = message.author.displayAvatarURL ? message.author.displayAvatarURL({ dynamic: true }) : null;

    let bonusText = '';
    if (info.married) bonusText += ' (+1,000 married)';
    if (factor < 1) bonusText += ` (${Math.round((1 - factor) * 100)}% cut)`;
    if (rewardMult > 1) bonusText += ` (x${rewardMult} event)`;

    const baseReward = info.reward - (info.marriageBonus || 0);

    message.channel.send({
      embeds: [embed('Daily Reward', [
        ['Claimed', `**+${finalReward.toLocaleString()}** ${config.currency}${bonusText}`, true],
        ['Streak', `**${info.streak} Day${info.streak === 1 ? '' : 's'}**`, true],
        ['Progress', baseReward >= info.max ? 'Max streak reached' : `+500/day (cap: ${info.max.toLocaleString()})`, true],
      ], 0x57f287)
      .setAuthor({ name: `${message.author.username}'s Daily Reward`, iconURL: avatarUrl })
      .setFooter({ text: 'Claim every 24h to maintain streak' })],
    });
  },
};
