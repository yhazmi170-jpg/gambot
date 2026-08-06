const db = require('../db');
const { embed } = require('../utils/embed');

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const RARITY_NAMES = {
  common: ['Rabbit', 'Squirrel', 'Mouse', 'Sparrow', 'Frog', 'Chick', 'Duckling', 'Hamster', 'Fish', 'Butterfly'],
  uncommon: ['Fox', 'Owl', 'Raccoon', 'Hedgehog', 'Ferret', 'Parrot', 'Turtle', 'Lizard'],
  rare: ['Wolf', 'Eagle', 'Deer', 'Panther', 'Hawk', 'Lynx', 'Cobra', 'Boar'],
  epic: ['Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Pegasus', 'Kraken', 'Basilisk'],
  legendary: ['Leviathan', 'Thunderbird', 'Kirin', 'Cerberus', 'Fenrir', 'Jormungandr'],
};

module.exports = {
  name: 'dex',
  helpCategory: 'Animals',
  helpArgs: '[rarity]',
  aliases: ['index', 'collection', 'pokedex', 'animaldex'],
  description: 'see which species you own and which you\'re missing',
  execute(message, args) {
    const owned = db.getOwnedSpecies(message.author.id);
    const ownedAll = Object.values(owned).flat();

    const wanted = (args[0] || '').toLowerCase();
    if (wanted && !RARITY_ORDER.includes(wanted)) {
      return message.channel.send({ embeds: [embed(`invalid rarity — use one of: ${RARITY_ORDER.join(', ')}`)] });
    }

    const total = Object.values(RARITY_NAMES).flat().length;
    const lines = [];
    for (const rarity of RARITY_ORDER) {
      if (wanted && wanted !== rarity) continue;
      const have = new Set(owned[rarity] || []);
      const names = RARITY_NAMES[rarity];
      const ownCount = names.filter(n => have.has(n)).length;
      const row = names.map(n => (have.has(n) ? `${RARITY_EMOJIS[rarity]} **${n}**` : `⬛ ~~${n}~~`)).join(' · ');
      lines.push(`${RARITY_LABEL[rarity]} (${ownCount}/${names.length})\n${row}`);
    }

    const desc = wanted
      ? lines[0]
      : lines.join('\n\n') + `\n\n**Collection: ${ownedAll.length}/${total}** (${Math.round((ownedAll.length / total) * 100)}%)`;

    message.channel.send({ embeds: [embed(desc, `📖 ${message.author.username}'s Animal Dex`).setColor(0x5865f2)] });
  },
};
