const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'streak',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'claim your daily logon streak bonus (grows up to day 7, resets after 48h)',
  aliases: ['logon'],
  execute(message, args) {
    const res = db.claimStreak(message.author.id);
    if (res.cooldown > 0) {
      const h = Math.floor(res.cooldown / 3600);
      const m = Math.floor((res.cooldown % 3600) / 60);
      const s = db.getStreak(message.author.id);
      return message.channel.send({ embeds: [error(`streak already claimed. come back in ${h}h ${m}m\ncurrent streak: **day ${s.count}** (best ${s.best})`)] });
    }
    const days = Array.from({ length: db.STREAK_MAX_DAY }, (_, i) => (i + 1 === res.count ? '**' : ''));
    const bar = Array.from({ length: db.STREAK_MAX_DAY }, (_, i) => {
      const day = i + 1;
      if (day < res.count) return '✅';
      if (day === res.count) return '🎯';
      return '⬜';
    }).join(' ');
    return message.channel.send({ embeds: [embed('🔥 Streak', [
      ['Day', `**${res.count}** ${bar}`],
      ['Reward', `**${res.reward.toLocaleString()}** ${config.currency}`],
      ['Next', `day ${Math.min(res.count + 1, db.STREAK_MAX_DAY)} = **${(db.STREAK_BASE * Math.min(res.count + 1, db.STREAK_MAX_DAY)).toLocaleString()}** ${config.currency}`],
      ['', `miss a day and it resets — max at day ${db.STREAK_MAX_DAY}`],
    ])] });
  },
};