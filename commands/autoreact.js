const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'autoreact',
  helpCategory: 'Shop',
  helpArgs: '[emoji]',
  description: 'set auto-react emoji (requires perk) — no args to check current',
  aliases: ['ar', 'autoreaction'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'auto_react')) {
      return message.channel.send({ embeds: [error("you don't own the auto-react perk. buy it from the shop.")] });
    }
    const emoji = args.join(' ');
    if (!emoji) {
      const cur = db.getAutoReactEmoji(message.author.id);
      return message.channel.send({ embeds: [cur ? success(`auto-react is **${cur}**`) : error('no auto-react set — usage: `v autoreact <emoji>`')] });
    }
    db.setAutoReactEmoji(message.author.id, emoji);
    message.channel.send({ embeds: [success(`auto-react emoji set to ${emoji}`)] });
  },
};
