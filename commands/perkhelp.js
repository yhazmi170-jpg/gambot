const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');
const { allShopItems } = require('./shop');

module.exports = {
  name: 'perkhelp',
  helpCategory: 'Perks',
  helpArgs: '[perk]',
  aliases: ['perks', 'ph'],
  description: 'list all perks and what they do',
  execute(message, args) {
    const items = allShopItems();
    const owned = new Set(db.getUserPerks(message.author.id).map(p => p.perk));
    const prefix = config.prefixes[0];
    const query = (args[0] || '').toLowerCase();

    if (query) {
      const item = items.find(i => i.id === query || i.name.toLowerCase().includes(query));
      if (!item) return message.channel.send({ embeds: [require('../utils/embed').error(`no perk matching \`${query}\` — try \`${prefix} perkhelp\` for the list`)] });
      const has = owned.has(item.id);
      const lines = [
        ['Name', item.name],
        ['What it does', item.desc],
        ['How to use', item.use],
        ['Cost', `**${item.price.toLocaleString()}** ${config.currency}${item.monthly ? ' / month' : ''}`],
        ['Status', has ? '✅ you own this' : '❌ not owned'],
      ];
      return message.channel.send({ embeds: [embed(`🛒 ${item.name}`, lines, 0x2b2d31)] });
    }

    const lines = items.map(i => {
      const mark = owned.has(i.id) ? '✅' : '⬜';
      return `${mark} **${i.name}** — ${i.desc} (${i.price.toLocaleString()}${i.monthly ? '/mo' : ''})`;
    });
    message.channel.send({ embeds: [embed('🛒 Perk Help', [
      ['Usage', `\`${prefix} perkhelp [perk]\` — details on one perk, or all of them`],
      ['Perks', lines.join('\n')],
      ['Note', 'Buy perks in the shop with `' + prefix + ' shop`. ✅ = you own it.'],
    ], 0x2b2d31)] });
  },
};
