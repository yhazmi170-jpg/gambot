const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'autoreact',
  aliases: ['ar', 'autoreaction'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'auto_react')) {
      return message.channel.send({ embeds: [error("you don't own the auto-react perk. buy it from the shop.")] });
    }
    const emoji = args.join(' ');
    if (!emoji) return message.channel.send({ embeds: [error('usage: v autoreact <emoji>')] });
    db.setAutoReactEmoji(message.author.id, emoji);
    message.channel.send({ embeds: [success(`auto-react emoji set to ${emoji}`)] });
  },
};
