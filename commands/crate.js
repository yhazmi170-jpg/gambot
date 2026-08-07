const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

const RARITY_EMOJIS = { common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟨', mythic: '👑' };

module.exports = {
  name: 'crate',
  helpCategory: 'Pets',
  helpArgs: '<common|premium|mythic>',
  description: 'open a loot crate for a random pet (with pity guarantee)',
  aliases: ['lootbox', 'box'],
  execute(message, args) {
    const userId = message.author.id;
    const crateId = (args[0] || '').toLowerCase();
    const crate = db.CRATES[crateId];
    if (!crate) {
      const list = Object.entries(db.CRATES).map(([id, c]) => `${RARITY_EMOJIS[id]} \`v crate ${id}\` — **${c.price.toLocaleString()}** coins`).join('\n');
      return message.channel.send({ embeds: [embed('Loot Crates', [
        ['Available', list],
        ['Pity', 'every crate opened counts toward a guaranteed drop. hit the pity and you\'re guaranteed the crates top rarity.'],
      ], 0x2b2d31)] });
    }
    const pity = db.getCratePity(userId);
    const res = db.openCrate(userId, crateId);
    if (!res.ok) {
      if (res.reason === 'coins') return message.channel.send({ embeds: [error(`you need **${crate.price.toLocaleString()}** coins for a ${crate.name}`)] });
      return message.channel.send({ embeds: [error('crate error')] });
    }
    const shinyTag = res.shiny ? ' ✨ **SHINY!**' : '';
    const pityMsg = `pity **${res.pity}/${crate.pity}** — guaranteed ${crate.pityRarity} at pity`;
    message.channel.send({ embeds: [embed(`${RARITY_EMOJIS[res.rarity]} ${crate.name}`, [
      ['You got', `${RARITY_EMOJIS[res.rarity]} **${res.species}** (${res.rarity}) Lv.1 — \`#${res.id}\`${shinyTag}\npersonality: **${res.trait}**`],
      ['Extras', [res.gems ? `+${res.gems} gems` : null, res.essence ? `+${res.essence} essence` : null, 'nothing extra'].filter(Boolean).join(', ')],
      ['Pity', pityMsg],
    ], res.rarity === 'mythic' || res.shiny ? 0xffd700 : 0x5865f2)] });
  },
};