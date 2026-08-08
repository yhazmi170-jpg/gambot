const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'glb',
  helpCategory: 'Leaderboards',
  helpArgs: '',
  description: 'this week\'s gambling leaderboard — top gamblers + weekly rewards',
  aliases: ['gamblinglb', 'betlb'],
  execute(message, args) {
    const week = db.currentLbWeek();
    const list = db.getWeeklyLb(week);
    if (!list.length) return message.channel.send({ embeds: [embed('🏆 Gambling Leaderboard', [
      ['', 'no bets recorded this week yet — go gamble!' ],
      ['', 'top 3 get rewarded automatically every week (set a channel with `Aovo lb #channel`)'],
    ])] });
    const fmt = (n) => `${n >= 0 ? '+' : ''}${n.toLocaleString()}`;
    const lines = list.map((x, i) => `${i < 3 ? ['🥇', '🥈', '🥉'][i] : '▫️'} **${fmt(x.net)}** — <@${x.user_id}> (bet ${x.amount.toLocaleString()})`).join('\n');
    const me = list.find(x => x.user_id === message.author.id);
    const myLine = me ? `\nyour place: **#${list.indexOf(me) + 1}** (${fmt(me.net)} this week)` : '\nyou haven\'t bet this week yet — get in there';
    return message.channel.send({ embeds: [embed('🏆 Weekly Gambling Leaderboard', [
      ['Best Gamblers (net win/loss)', lines],
      ['Rewards', '🥇 1,000,000 · 🥈 500,000 · 🥉 250,000 · 4th 200,000 · 5th 150,000 · 6th 100,000 · 7th 75,000 · 8th 60,000 · 9th 50,000 · 10th 40,000 — paid automatically when the week ends'],
      ['', `new week in <t:${week * 604800 + 604800}:R>${myLine}`],
    ], 0xf1c40f)] });
  },
};