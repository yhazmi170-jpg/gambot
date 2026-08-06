const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');
const { allShopItems } = require('./shop');

const FEATURES = [
  { id: 'bank shark', name: '🦈 Bank Shark (loan shark)', desc: 'borrow from the shark even if you\'re broke', use: 'Use `v bank shark <amount/max>` — lends up to 2M at 50% interest' },
  { id: 'loan', name: '🏦 Bank Loan', desc: 'borrow up to 2x your net worth from the bank', use: 'Use `v bank loan <amount/max>` — 30% one-time interest · `v bank loan pay` to repay' },
  { id: 'shark', name: '🦈 Bank Shark (loan shark)', desc: 'borrow from the shark even if you\'re broke', use: 'Use `v bank shark <amount/max>` — lends up to 2M at 50% interest' },
  { id: 'vault', name: '🏦 Vault', desc: 'per-guild shared money pot', use: 'Use `v vault deposit/withdraw <amount>` — withdraw only what you put in' },
  { id: 'stocks', name: '📈 Stocks', desc: 'buy and sell stocks, market drifts every hour', use: 'Use `v stocks buy <SYMBOL> <shares>` / `v stocks sell <SYMBOL> all` / `v stocks port`' },
];

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
    const query = args.join(' ').toLowerCase().trim();

    if (query) {
      const feature = FEATURES.find(f => f.id === query || f.name.toLowerCase().includes(query));
      const item = feature || items.find(i => i.id === query || i.name.toLowerCase().includes(query));
      if (!item) return message.channel.send({ embeds: [error(`no perk matching \`${query}\` — try \`${prefix} perkhelp\` for the list`)] });
      if (feature) {
        const lines = [
          ['Name', feature.name],
          ['What it does', feature.desc],
          ['How to use', feature.use],
          ['Cost', 'Free — a built-in feature'],
        ];
        return message.channel.send({ embeds: [embed(feature.name, lines, 0x2b2d31)] });
      }
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
    const featureLines = FEATURES.filter(f => f.id === 'bank shark' || f.id === 'vault' || f.id === 'stocks').map(f => `🔧 **${f.name}** — ${f.desc}`);
    message.channel.send({ embeds: [embed('🛒 Perk Help', [
      ['Usage', `\`${prefix} perkhelp [perk]\` — details on one perk, or all of them`],
      ['Perks', lines.join('\n')],
      ['Built-in Features', featureLines.join('\n')],
      ['Note', 'Buy perks in the shop with `' + prefix + ' shop`. ✅ = you own it.'],
    ], 0x2b2d31)] });
  },
};
