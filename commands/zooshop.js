const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'zooshop',
  helpCategory: 'Pets',
  helpArgs: '[buy <item>]',
  description: 'buy cosmetic decorations that show at the top of your zoo',
  aliases: ['zshop', 'decor'],
  execute(message, args) {
    const userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'buy') {
      const itemId = (args[1] || '').toLowerCase();
      if (!itemId) return message.channel.send({ embeds: [error('usage: `v zooshop buy <item>` — see items with `v zooshop`')] });
      const res = db.buyZooDecor(userId, itemId);
      if (!res.ok) {
        const reasons = { notfound: 'that item does not exist', coins: 'not enough coins', owned: 'you already own that decoration' };
        return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not buy')] });
      }
      return message.channel.send({ embeds: [embed('Purchased!', [['Item', `${res.decor.emoji} ${res.decor.name}`], ['Cost', `${res.decor.price.toLocaleString()} ${config.currency}`], ['Note', 'show off at the top of your `v zoo`']])] });
    }

    const owned = db.getZooDecors(userId);
    const lines = db.ZOO_DECOR.map(d => {
      const has = owned.includes(d.id);
      return `${has ? '✅' : '⬜'} ${d.emoji} **${d.name}** — ${d.price.toLocaleString()} coins${has ? ' (owned)' : ''}`;
    }).join('\n');
    return message.channel.send({ embeds: [embed('🏛️ Zoo Decor Shop', [
      ['Items', lines],
      ['', 'buy with `v zooshop buy <item>` — they show at the top of your zoo'],
    ])] });
  },
};