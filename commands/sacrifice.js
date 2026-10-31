const db = require('../db');
const { success, error } = require('../utils/embed');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

module.exports = {
  name: 'sacrifice',
  helpCategory: 'Pets',
  helpArgs: '<species|rarity|color|all> [count] | weapons <rarity|all> [count]',
  aliases: ['sac'],
  description: 'sacrifice animals or weapons for essence',
  execute(message, args) {
    const userId = message.author.id;
    const query = (args[0] || '').toLowerCase();
    if (!query) {
      const values = Object.entries(db.ESSENCE_VALUES).map(([r, v]) => `${RARITY_EMOJIS[r]} ${r} = ${v} essence`).join(' · ');
      return message.channel.send({ embeds: [error(`usage: \`v sacrifice <species|rarity|color|all> [count]\` · \`v sacrifice weapons <rarity|all> [count]\`\n\n${values}\n\n\`v sacrifice rabbit\` sacrifices all your rabbits\n\`v sacrifice common\` or \`v sacrifice gray\` sacrifices all common animals\n\`v sacrifice weapons all\` sacrifices all weapons\n\`v sacrifice weapons common\` sacrifices common weapons\n\`v sacrifice all\` sacrifices every animal you own\n\ncolor shortcuts: gray = common · green = uncommon · blue = rare · purple = epic · yellow = legendary\n\nanimals on your battle team and equipped weapons are always skipped`)] });
    }

    const isWeaponQuery = ['weapon', 'weapons', 'wep', 'weps'].includes(query);
    if (isWeaponQuery) {
      const target = (args[1] || '').toLowerCase();
      if (!target) {
        const values = Object.entries(db.WEAPON_ESSENCE_VALUES).map(([r, v]) => `${db.WEAPON_RARITY_TAG[r] || '⬜'} ${r} = ${v} essence`).join(' · ');
        return message.channel.send({
          embeds: [error(`usage: \`v sacrifice weapon <id>\` · \`v sacrifice weapons <rarity|all> [count]\`\n\n${values}\n\n\`v sacrifice weapons all\` sacrifices all weapons\n\`v sacrifice weapons common\` sacrifices common weapons\n\`v sacrifice weapons rare 2\` sacrifices 2 rare weapons\n\nequipped weapons on battle pets are always skipped`)],
        });
      }

      const id = parseInt(target, 10);
      if (!isNaN(id) && target === String(id)) {
        const res = db.sacrificeWeapon(id, userId);
        if (!res.ok) {
          return message.channel.send({ embeds: [error(res.reason === 'notfound' ? 'weapon not found' : "that weapon isn't yours")] });
        }
        const tag = db.WEAPON_RARITY_TAG[res.weapon.rarity] || '⬜';
        const lines = [
          `sacrificed **${res.weapon.name}** (\`#${res.weapon.id}\` ${tag}) for **${res.essence}** essence`,
          `you now have **${db.getEssence(userId).toLocaleString()}** essence`,
        ];
        return message.channel.send({ embeds: [success(lines.join('\n'))] });
      }

      let count = null;
      if (args[2]) {
        const n = parseInt(args[2], 10);
        if (!isNaN(n) && n > 0) count = n;
      }

      const result = db.sacrificeWeapons(userId, target, count);
      if (!result.sacrificed) {
        let msg = `no weapons matched \`${args[1]}\``;
        if (result.skipped > 0) msg += ` — ${result.skipped} matched weapon(s) are equipped on battle pets and were skipped`;
        return message.channel.send({ embeds: [error(msg)] });
      }

      const lines = [
        `sacrificed **${result.sacrificed}** weapon(s) for **${result.essence}** essence`,
        `you now have **${db.getEssence(userId).toLocaleString()}** essence`,
      ];
      if (result.skipped > 0) lines.push(`${result.skipped} equipped weapon(s) were skipped`);
      return message.channel.send({ embeds: [success(lines.join('\n'))] });
    }

    let count = null;
    if (args[1]) {
      const n = parseInt(args[1], 10);
      if (!isNaN(n) && n > 0) count = n;
    }

    const result = db.sacrificeAnimals(userId, query, count);
    if (!result.sacrificed) {
      // If query was numeric, check if it was a weapon ID!
      const id = parseInt(query, 10);
      if (!isNaN(id) && query === String(id)) {
        const weapon = db.getWeapon(id);
        if (weapon && String(weapon.user_id) === String(userId)) {
          const res = db.sacrificeWeapon(id, userId);
          const tag = db.WEAPON_RARITY_TAG[res.weapon.rarity] || '⬜';
          const lines = [
            `sacrificed **${res.weapon.name}** (\`#${res.weapon.id}\` ${tag}) for **${res.essence}** essence`,
            `you now have **${db.getEssence(userId).toLocaleString()}** essence`,
          ];
          return message.channel.send({ embeds: [success(lines.join('\n'))] });
        }
      }

      let msg = `no animals matched \`${args[0]}\``;
      if (result.skipped > 0) msg += ` — ${result.skipped} matched animal(s) are on your battle team and were skipped`;
      return message.channel.send({ embeds: [error(msg)] });
    }

    const lines = [`sacrificed **${result.sacrificed}** animal(s) for **${result.essence}** essence`, `you now have **${db.getEssence(userId).toLocaleString()}** essence`];
    if (result.skipped > 0) lines.push(`${result.skipped} team animal(s) were skipped`);
    if (result.unknown > 0) lines.push(`${result.unknown} animal(s) without an essence value (${(result.unknownRarities || []).join(', ')}) were left alone`);
    db.trackProgress(userId, 'sacrifice', result.sacrificed);
    db.addPassXp(userId, db.PASS_XP.sacrifice * result.sacrificed);
    lines.push('`v upgrade <trait>` to boost hunts · `v autohuntbot` to upgrade the autohunt bot');

    message.channel.send({ embeds: [success(lines.join('\n'))] });
  },
};
