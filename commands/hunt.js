const db = require('../db');
const { embed } = require('../utils/embed');

const HUNT_COST = 5;
const MAX_HUNT = 5;
const GEM_DROP = { common: 0, uncommon: 0.04, rare: 0.10, epic: 0.20, legendary: 0.40 };
const GEM_AMOUNT = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 3 };

const rarityColors = { common: 0x95a5a6, uncommon: 0x2ecc71, rare: 0x3498db, epic: 0x9b59b6, legendary: 0xf1c40f };
const rarityEmojis = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

module.exports = {
  name: 'hunt',
  helpCategory: 'Pets',
  helpArgs: '[count]',
  aliases: ['h'],
  description: 'hunt for animals (costs 5 coins; hunt up to 5 at once using gems)',
  async execute(message, args) {
    const userId = message.author.id;

    let count = 1;
    if (args[0]) {
      const n = parseInt(args[0], 10);
      if (!isNaN(n) && n > 0) count = Math.min(n, MAX_HUNT);
    }

    const bal = db.getBalance(userId);
    const coins = HUNT_COST * count;
    const gemsNeeded = count > 1 ? count - 1 : 0;
    const gems = db.getGems(userId);

    if (bal < coins) return message.channel.send({ embeds: [require('../utils/embed').error(`you need ${coins} coins to hunt`)] });
    if (gems < gemsNeeded) return message.channel.send({ embeds: [require('../utils/embed').error(`hunting ${count} at once needs **${gemsNeeded} gem${gemsNeeded > 1 ? 's' : ''}** (you have ${gems}) — use \`v hunt\` for a single hunt, or buy gems in the shop`)] });

    const cd = db.getHuntCooldown(userId);
    const elapsed = Date.now() / 1000 - cd;
    if (cd > 0 && elapsed < 10) {
      const wait = Math.ceil(10 - elapsed);
      return message.channel.send({ embeds: [require('../utils/embed').error(`wait ${wait}s before hunting again`)] });
    }

    db.addBalance(userId, -coins);
    if (gemsNeeded > 0) db.addGems(userId, -gemsNeeded);
    db.setHuntCooldown(userId);

    const results = [];
    let gemsEarned = 0;
    for (let i = 0; i < count; i++) {
      const animal = db.addAnimal(userId);
      if (Math.random() < GEM_DROP[animal.rarity]) {
        const amt = GEM_AMOUNT[animal.rarity];
        db.addGems(userId, amt);
        gemsEarned += amt;
        animal.gemDrop = amt;
      }
      results.push(animal);
    }

    const fields = results.map((a, i) => [
      `#${i + 1}`,
      `${rarityEmojis[a.rarity]} **${a.species}** — ${a.rarity.toUpperCase()}${a.gemDrop ? ` 💎+${a.gemDrop}` : ''}\n` +
      `❤️ ${a.hp} ⚔️ ${a.attack} 🛡️ ${a.defense}`,
      true,
    ]);

    const summary = [`\`v zoo\` to see all your animals`];
    if (count > 1) summary.push(`spent **${coins}** coins + **${gemsNeeded} gem${gemsNeeded > 1 ? 's' : ''}**`);
    else summary.push(`spent **${coins}** coins`);
    if (gemsEarned > 0) summary.push(`💎 found **${gemsEarned} gem${gemsEarned > 1 ? 's' : ''}**!`);

    message.channel.send({
      embeds: [embed(`${rarityEmojis[results[0].rarity]} Hunt${count > 1 ? ` x${count}` : ''}`, [
        ...fields,
        ['', summary.join('\n')],
      ], 0x2b2d31)],
    });
  },
};
