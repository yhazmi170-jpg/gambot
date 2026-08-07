const db = require('../db');
const { embed, error } = require('../utils/embed');

const HUNT_COST = db.HUNT_COST_BASE;

const rarityColors = { common: 0x95a5a6, uncommon: 0x2ecc71, rare: 0x3498db, epic: 0x9b59b6, legendary: 0xf1c40f, mythic: 0xffd700 };
const rarityEmojis = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '👑' };

module.exports = {
  name: 'hunt',
  helpCategory: 'Pets',
  helpArgs: '[count]',
  aliases: ['h'],
  description: 'hunt for animals — every 5 gems you hold = +1 animal per hunt (max 10)',
  async execute(message, args) {
    const userId = message.author.id;

    const capacity = db.huntCapacity(userId);
    let count = capacity;
    if (args[0]) {
      const n = parseInt(args[0], 10);
      if (!isNaN(n) && n > 0) count = Math.min(n, capacity);
    }

    const bal = db.getBalance(userId);
    const coins = HUNT_COST * count;

    if (bal < coins) return message.channel.send({ embeds: [error(`you need ${coins} coins to hunt`)] });

    const cd = db.getHuntCooldown(userId);
    const elapsed = Date.now() / 1000 - cd;
    if (cd > 0 && elapsed < 10) {
      const wait = Math.ceil(10 - elapsed);
      return message.channel.send({ embeds: [error(`wait ${wait}s before hunting again`)] });
    }

    const traits = db.getTraits(userId);
    const yieldInfo = db.huntYield(userId);

    db.addBalance(userId, -coins);
    db.setHuntCooldown(userId);

    const results = [];
    let gemsEarned = 0;
    let coinsEarned = 0;
    let eggsFound = 0;
    for (let i = 0; i < count; i++) {
      const animal = db.addAnimal(userId, traits.efficiency);
      const g = db.rollGemDrop(animal.rarity, yieldInfo.radarMult);
      if (g > 0) {
        db.addGems(userId, g);
        gemsEarned += g;
        animal.gemDrop = g;
      }
      if (db.rollEggDrop(userId)) {
        db.addEgg(userId, 1);
        eggsFound++;
      }
      results.push(animal);
    }
    if (yieldInfo.coins > 0) {
      db.addBalance(userId, yieldInfo.coins * count);
      coinsEarned = yieldInfo.coins * count;
    }
    const xpResult = yieldInfo.xp > 0 ? db.addXpRaw(userId, yieldInfo.xp * count) : null;
    db.addQuestProgress(userId, 'hunt', count);
    db.addBountyProgress(userId, 'hunt', count);

    const fields = results.map((a, i) => [
      `#${i + 1}`,
      `${rarityEmojis[a.rarity]} **${a.species}** — ${a.rarity.toUpperCase()}${a.gemDrop ? ` 💎+${a.gemDrop}` : ''}\n` +
      `❤️ ${a.hp} ⚔️ ${a.attack} 🛡️ ${a.defense}`,
      true,
    ]);

    const summary = [`\`v zoo\` to see all your animals`];
    summary.push(`spent **${coins}** coins`);
    if (coinsEarned > 0) summary.push(`gain trait: **+${coinsEarned}** coins`);
    if (gemsEarned > 0) summary.push(`💎 found **${gemsEarned} gem${gemsEarned > 1 ? 's' : ''}**!`);
    if (eggsFound > 0) summary.push(`🥚 found **${eggsFound} egg${eggsFound > 1 ? 's' : ''}**! (\`v hatch\` to open)`);
    summary.push(`💎 gems: **${db.getGems(userId)}**`);
    if (xpResult) summary.push(`**+${yieldInfo.xp * count}** xp`);
    if (xpResult && xpResult.leveledUp) summary.push(`leveled up to **${xpResult.newLevel}**!`);
    summary.push('`v huntbot` for upgrades · `v sacrifice` for essence');

    message.channel.send({
      embeds: [embed(`${rarityEmojis[results[0].rarity]} Hunt${count > 1 ? ` x${count}` : ''}`, [
        ...fields,
        ['', summary.join('\n')],
      ], 0x2b2d31)],
    });
  },
};
