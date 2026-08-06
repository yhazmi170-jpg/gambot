const db = require('../db');
const { success, error } = require('../utils/embed');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

module.exports = {
  name: 'sacrifice',
  helpCategory: 'Pets',
  helpArgs: '<species|rarity|all> [count]',
  aliases: ['sac'],
  description: 'sacrifice animals for essence (common 1 · uncommon 3 · rare 8 · epic 25 · legendary 100)',
  execute(message, args) {
    const userId = message.author.id;
    const query = (args[0] || '').toLowerCase();
    if (!query) {
      const values = Object.entries(db.ESSENCE_VALUES).map(([r, v]) => `${RARITY_EMOJIS[r]} ${r} = ${v} essence`).join(' · ');
      return message.channel.send({ embeds: [error(`usage: \`v sacrifice <species|rarity|all> [count]\`\n\n${values}\n\n\`v sacrifice rabbit\` sacrifices all your rabbits\n\`v sacrifice common\` sacrifices all common animals\n\`v sacrifice wolf 2\` sacrifices just 2 wolves\n\`v sacrifice all\` sacrifices every animal you own\n\nanimals on your battle team are always skipped`)] });
    }

    let count = null;
    if (args[1]) {
      const n = parseInt(args[1], 10);
      if (!isNaN(n) && n > 0) count = n;
    }

    const result = db.sacrificeAnimals(userId, query, count);
    if (!result.sacrificed) {
      let msg = `no animals matched \`${args[0]}\``;
      if (result.skipped > 0) msg += ` — ${result.skipped} matched animal(s) are on your battle team and were skipped`;
      return message.channel.send({ embeds: [error(msg)] });
    }

    const lines = [`sacrificed **${result.sacrificed}** animal(s) for **${result.essence}** essence`, `you now have **${db.getEssence(userId)}** essence`];
    if (result.skipped > 0) lines.push(`${result.skipped} team animal(s) were skipped`);
    lines.push('`v upgrade <trait>` to boost hunts · `v autohuntbot` to upgrade the autohunt bot');

    message.channel.send({ embeds: [success(lines.join('\n'))] });
  },
};
