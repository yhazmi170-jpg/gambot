const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'hunt',
  helpCategory: 'Pets',
  helpArgs: '',
  aliases: ['h'],
  description: 'hunt for animals (costs 5 coins)',
  async execute(message, args) {
    const userId = message.author.id;
    const bal = db.getBalance(userId);
    if (bal < 5) return message.channel.send({ embeds: [require('../utils/embed').error('you need 5 coins to hunt')] });

    const cd = db.getHuntCooldown(userId);
    const elapsed = Date.now() / 1000 - cd;
    if (cd > 0 && elapsed < 10) {
      const wait = Math.ceil(10 - elapsed);
      return message.channel.send({ embeds: [require('../utils/embed').error(`wait ${wait}s before hunting again`)] });
    }

    db.addBalance(userId, -5);
    db.setHuntCooldown(userId);

    const animal = db.addAnimal(userId);

    const rarityColors = { common: 0x95a5a6, uncommon: 0x2ecc71, rare: 0x3498db, epic: 0x9b59b6, legendary: 0xf1c40f };
    const rarityEmojis = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };


    message.channel.send({
      embeds: [embed(`${rarityEmojis[animal.rarity]} Hunt`, [
        ['Species', `**${animal.species}**`],
        ['Rarity', `**${animal.rarity.toUpperCase()}**`],
        ['Stats', `❤️${animal.hp} ⚔️${animal.attack} 🛡️${animal.defense}`],
        ['', `\`v zoo\` to see all your animals`],
      ], rarityColors[animal.rarity])],
    });
  },
};
