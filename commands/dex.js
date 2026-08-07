const db = require('../db');
const { embed } = require('../utils/embed');

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_EMOJIS = { common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟨', mythic: '👑' };
const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };

module.exports = {
  name: 'dex',
  helpCategory: 'Pets',
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

    const allNames = db.SPECIES;
    const total = Object.values(allNames).flat().length;
    const lines = [];
    for (const rarity of RARITY_ORDER) {
      if (wanted && wanted !== rarity) continue;
      const have = new Set(owned[rarity] || []);
      const names = allNames[rarity] || [];
      const ownCount = names.filter(n => have.has(n)).length;
      const row = names.map(n => (have.has(n) ? `${RARITY_EMOJIS[rarity]} **${n}**` : `— ~~${n}~~`)).join(' · ');
      lines.push(`${RARITY_LABEL[rarity]} (${ownCount}/${names.length})\n${row}`);
    }

    const desc = wanted
      ? lines[0]
      : lines.join('\n\n') + `\n\n**Collection: ${ownedAll.length}/${total}** (${Math.round((ownedAll.length / total) * 100)}%)`;

    const e = embed(`👑 ${message.author.username}'s Animal Dex`);
    e.setDescription(desc).setColor(0x5865f2);
    message.channel.send({ embeds: [e] });
  },
};