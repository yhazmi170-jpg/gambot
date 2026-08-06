const db = require('../db');
const { embed, error, success } = require('../utils/embed');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

module.exports = {
  name: 'hatch',
  helpCategory: 'Pets',
  helpArgs: '[all]',
  description: 'hatch a pet egg — rare eggs drop from hunting!',
  aliases: ['hatchegg', 'openegg'],
  async execute(message, args) {
    const userId = message.author.id;
    const eggs = db.getEggs(userId);
    if (eggs <= 0) return message.channel.send({ embeds: [error('you have no eggs — hunt more! eggs drop while hunting and autohunting')] });

    const all = (args[0] || '').toLowerCase() === 'all';
    const count = all ? eggs : 1;
    const results = [];
    for (let i = 0; i < count; i++) {
      const a = db.hatchEgg(userId);
      if (!a) break;
      results.push(a);
    }
    if (!results.length) return message.channel.send({ embeds: [error('nothing hatched — you ran out of eggs')] });

    const remaining = db.getEggs(userId);
    if (all) {
      const lines = results.map(a => `${RARITY_EMOJIS[a.rarity]} **${a.species}** (${a.rarity}) Lv.${a.level}`);
      return message.channel.send({ embeds: [embed(`🥚 Hatched ${results.length} egg${results.length > 1 ? 's' : ''}`, [
        ['', lines.join('\n')],
        ['Eggs left', `${remaining}`],
      ], 0x57f287)] });
    }

    const a = results[0];
    return message.channel.send({ embeds: [embed('🥚 Egg Hatched!', [
      ['', `${RARITY_EMOJIS[a.rarity]} **${a.species}** — ${a.rarity}`],
      ['Stats', `Lv.${a.level} · ❤️ ${a.hp}/${a.max_hp} · ⚔️ ${a.attack} · 🛡️ ${a.defense}`],
      ['Eggs left', `${remaining} · \`v hatch all\` to open them all`],
    ], 0x57f287)] });
  },
};
