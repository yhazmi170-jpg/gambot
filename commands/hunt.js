const db = require('../db');
const { embed, error } = require('../utils/embed');

const HUNT_COST = db.HUNT_COST_BASE;

const rarityColors = { common: 0x95a5a6, uncommon: 0x2ecc71, rare: 0x3498db, epic: 0x9b59b6, legendary: 0xf1c40f, mythic: 0xffd700 };
const rarityEmojis = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '👑' };
const HUNT_VIBES = [
  'the woods are alive tonight', 'a weird chill runs through the air',
  'u hear rustling in every bush', 'the trail is fresh — something big passed here',
  'the pet gods smile on u', 'u feel watched by a dozen small eyes',
  'daylight fades but the hunting is good', 'a shooting star zips overhead',
  'the air smells like pine and mystery', 'luck is on ur side today',
  'something shiny glints in the distance', 'the forest whispers ur name (slightly creepy)',
  'u found a secret grove', 'the tracks split in every direction — u pick one',
  'a crow watches from a branch, judging', 'the moon peeks out just for u',
];

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
    let weaponCratesFound = 0;
    const xpMult = db.eventMult('xpMult');
    const xpEarned = Math.floor(yieldInfo.xp * count * xpMult);
    for (let i = 0; i < count; i++) {
      const animal = db.addAnimal(userId, traits.efficiency);
      let g = db.rollGemDrop(animal.rarity, yieldInfo.radarMult);
      if (g > 0 && db.isCommunityEvent('gem_rush')) g *= 2;
      if (g > 0) {
        db.addGems(userId, g);
        gemsEarned += g;
        animal.gemDrop = g;
      }
      if (db.rollEggDrop(userId)) {
        db.addEgg(userId, 1);
        eggsFound++;
      }
      if (Math.random() < db.WEAPON_BATTLE_DROP_CHANCE) {
        db.addWeaponCrate(userId, 1);
        weaponCratesFound++;
      }
      results.push(animal);
    }
    if (yieldInfo.coins > 0) {
      db.addBalance(userId, yieldInfo.coins * count);
      coinsEarned = yieldInfo.coins * count;
    }
    const xpResult = yieldInfo.xp > 0 ? db.addXpRaw(userId, xpEarned) : null;
    if (gemsEarned > 0) db.trackProgress(userId, 'gem', gemsEarned);
    db.trackProgress(userId, 'hunt', count);
    if (message.guild && db.isCommunityEvent('great_hunt')) {
      try { db.addCommunityProgress(message.guild.id, 'great_hunt', count, userId, message.guild.memberCount); } catch (e) {}
    }
    db.addChecklistProgress(userId, 'daily', 'hunt', count);
    db.addChecklistProgress(userId, 'weekly', 'hunt', count);
    db.addPassXp(userId, db.PASS_XP.hunt * count);

    if (message.guild) { try { db.recordDiscoveries(message.guild.id, userId, results); } catch (e) {} }

    const rarityRank = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
    let highestRarity = 'common';
    for (const a of results) {
      const r = (a.rarity || 'common').toLowerCase();
      if ((rarityRank[r] || 0) > (rarityRank[highestRarity] || 0)) highestRarity = r;
    }
    const embedColor = rarityColors[highestRarity] || 0x5865f2;

    const fields = results.map((a, i) => [
      `#${i + 1} • ${a.species}`,
      `${rarityEmojis[(a.rarity || 'common').toLowerCase()] || '⚪'} **${a.rarity.toUpperCase()}**${a.gemDrop ? ` 💎+${a.gemDrop}` : ''}\n` +
      `❤️ \`${a.hp}\` ⚔️ \`${a.attack}\` 🛡️ \`${a.defense}\``,
      true,
    ]);

    const summary = [];
    summary.push(`🌲 *${HUNT_VIBES[Math.floor(Math.random() * HUNT_VIBES.length)]}*`);
    summary.push(`🪙 Spent: **${coins.toLocaleString()}** coins`);
    if (coinsEarned > 0) summary.push(`💰 Coin Yield: **+${coinsEarned.toLocaleString()}** coins`);
    if (gemsEarned > 0) summary.push(`💎 Found: **${gemsEarned} gem${gemsEarned > 1 ? 's' : ''}**!`);
    if (eggsFound > 0) summary.push(`🥚 Found: **${eggsFound} egg${eggsFound > 1 ? 's' : ''}**! (\`v hatch\`)`);
    if (weaponCratesFound > 0) summary.push(`🏴‍☠️ Found: **${weaponCratesFound} weapon crate${weaponCratesFound > 1 ? 's' : ''}**! (\`v weaponcrate open\`)`);
    if (xpResult) summary.push(`✨ XP: **+${xpEarned}** xp${xpMult > 1 ? ` (x${xpMult} event)` : ''}`);
    if (xpResult && xpResult.leveledUp) summary.push(`⬆️ **Leveled up to Level ${xpResult.newLevel}!**`);

    const avatarUrl = message.author.displayAvatarURL ? message.author.displayAvatarURL({ dynamic: true }) : null;

    message.channel.send({
      embeds: [embed(`${rarityEmojis[highestRarity] || '⚪'} Hunt Expedition${count > 1 ? ` (${count}x)` : ''}`, [
        ...fields,
        ['🎒 Expedition Summary', summary.join('\n'), false],
      ], embedColor)
      .setAuthor({ name: `${message.author.username}'s Hunt`, iconURL: avatarUrl })
      .setFooter({ text: `Gems: ${db.getGems(userId)} • v zoo to view inventory • v sacrifice for essence` })],
    });
  },
};
