const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'setbadge',
  helpCategory: 'Shop',
  helpArgs: '<emoji>',
  description: 'set your badge emoji (requires badge perk)',
  async execute(message, args) {
    if (!db.hasPerk(message.author.id, 'badge')) return message.channel.send({ embeds: [error('you need the badge perk — buy it from `v shop`')] });
    const emoji = args[0];
    if (!emoji) return message.channel.send({ embeds: [error('usage: `v setbadge <emoji>`')] });
    db.setBadgeEmoji(message.author.id, emoji);
    message.channel.send({ embeds: [success(`badge emoji set to ${emoji}`)] });
  },
};
