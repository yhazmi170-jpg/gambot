const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

const RARITY_EMOJIS = { common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟨', mythic: '👑' };

module.exports = {
  name: 'fuse',
  helpCategory: 'Pets',
  helpArgs: '<id1> <id2>',
  description: 'fuse two pets into one stronger pet (100k coins, mythic excluded)',
  aliases: ['merge'],
  execute(message, args) {
    const userId = message.author.id;
    const id1 = parseInt(args[0], 10);
    const id2 = parseInt(args[1], 10);
    if (!id1 || !id2) return message.channel.send({ embeds: [error('usage: `v fuse <animal_id_1> <animal_id_2>`')] });
    const a1 = db.getAnimal(id1);
    const a2 = db.getAnimal(id2);
    if (!a1 || !a2 || a1.user_id !== userId || a2.user_id !== userId) return message.channel.send({ embeds: [error('both animals must be yours')] });
    const user = db.ensureUser(userId);
    if ((user.balance || 0) < db.FUSION_COST) return message.channel.send({ embeds: [error(`fusing costs **${db.FUSION_COST.toLocaleString()}** ${config.currency}`)] });
    const res = db.fuseAnimals(userId, id1, id2);
    if (!res.ok) {
      const reasons = { team: 'pets on your battle team cannot be fused — remove them first', mythic: 'mythic pets cannot be fused', same: 'pick two different pets' };
      return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not fuse')] });
    }
    return message.channel.send({ embeds: [embed('🧬 Fusion!', [
      ['Result', `${RARITY_EMOJIS[res.rarity]} **${res.species}** (${res.rarity}) Lv.${res.level} — \`#${res.id}\`${res.shiny ? ' ✨ SHINY' : ''}`],
      ['Personality', res.trait],
      ['Cost', `${db.FUSION_COST.toLocaleString()} ${config.currency}`],
      ['Note', 'both original pets were consumed'],
    ], 0x9b59b6)] });
  },
};