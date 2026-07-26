const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'setlb',
  helpCategory: 'Shop',
  helpArgs: '<emoji>',
  aliases: ['setleaderboard'],
  description: 'set your leaderboard emoji (requires colored_lb perk)',
  async execute(message, args) {
    if (!db.hasPerk(message.author.id, 'colored_lb')) return message.channel.send({ embeds: [error('you need the colored leaderboard perk — buy it from `v shop`')] });
    const emoji = args[0];
    if (!emoji) return message.channel.send({ embeds: [error('usage: `v setlb <emoji>`')] });
    db.setLbEmoji(message.author.id, emoji);
    message.channel.send({ embeds: [success(`leaderboard emoji set to ${emoji}`)] });
  },
};
