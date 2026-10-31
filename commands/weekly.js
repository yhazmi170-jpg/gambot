const db = require('../db');
const { error, success } = require('../utils/embed');
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
    const raw = Math.floor(base * factor);
    const married = db.marriedMult(message.author.id);
    const isMarriedUser = db.isMarried(message.author.id);
    const marriageBonus = isMarriedUser ? 1000 : 0;
    const rewardMult = db.eventMult('rewardMult');
    const amount = Math.floor((raw * married + marriageBonus) * rewardMult);
    db.claimWeekly(message.author.id, raw);
    const alreadyCredited = Math.floor(raw * married) + marriageBonus;
    const bonus = amount - alreadyCredited;
    if (bonus > 0) db.addBalance(message.author.id, bonus);

    let notes = [];
    if (base > config.weeklyAmount) notes.push('daily cap perk!');
    if (isMarriedUser) notes.push('+1,000 married');
    if (rewardMult > 1) notes.push(`event x${rewardMult}`);
    if (factor < 1) notes.push(`${Math.round((1 - factor) * 100)}% reduction`);
    const noteText = notes.length ? ` (${notes.join(' · ')})` : '';

    message.channel.send({
      embeds: [success(`claimed **${amount.toLocaleString()}** ${config.currency} as your weekly reward!${noteText}`)],
    });
  },
};
