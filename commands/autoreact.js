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
    const emoji = args.join(' ').trim();
    const lower = emoji.toLowerCase();
    if (!emoji) {
      const cur = db.getAutoReactEmoji(message.author.id);
      return message.channel.send({ embeds: [cur ? success(`auto-react is **${cur}** — remove it with \`v autoreact remove\``) : error('no auto-react set — usage: `v autoreact <emoji>`')] });
    }
    if (lower === 'remove' || lower === 'off' || lower === 'clear' || lower === 'none') {
      db.clearAutoReactEmoji(message.author.id);
      return message.channel.send({ embeds: [success('auto-react removed — no more auto-reactions')] });
    }
    db.setAutoReactEmoji(message.author.id, emoji);
    message.channel.send({ embeds: [success(`auto-react emoji set to ${emoji}`)] });
  },
};
