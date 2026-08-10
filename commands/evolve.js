const db = require('../db');
const { embed, error } = require('../utils/embed');

const RARITY_EMOJIS = { common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟨', mythic: '👑' };

module.exports = {
  name: 'evolve',
  helpCategory: 'Pets',
  helpArgs: '<id>',
  description: 'evolve a pet into a random higher-rarity species (costs essence)',
  aliases: ['evo'],
  execute(message, args) {
    const userId = message.author.id;
    const id = parseInt(args[0], 10);
    if (!id) return message.channel.send({ embeds: [error('usage: `v evolve <animal_id>`')] });
    const a = db.getAnimal(id);
    if (!a || a.user_id !== userId) return message.channel.send({ embeds: [error('animal not found')] });
    const can = db.canEvolve(a);
    if (!can.ok) {
      const reasons = { max: 'mythic pets are already max rarity — they cannot evolve further', level: `needs level **${can.need}**`, essence: `you need **${can.cost}** essence` };
      return message.channel.send({ embeds: [error(reasons[can.reason] || 'cannot evolve that pet')] });
    }
    const user = db.ensureUser(userId);
    if ((user.essence || 0) < can.cost) return message.channel.send({ embeds: [error(`evolving needs **${can.cost}** essence — you have ${user.essence || 0}`)] });
    const res = db.evolveAnimal(id, user.essence);
    if (!res.ok) return message.channel.send({ embeds: [error('could not evolve')] });
    return message.channel.send({ embeds: [embed(`${RARITY_EMOJIS[(a.raliases||').toLowerCase()] || '?'} → ${RARITY_EMOJIS[res.rarity]} Evolution!`, [
      ['Before', `${a.species} (${a.rarity}) Lv.${a.level}`],
      ['After', `${res.species} (**${res.rarity}**) — stats +15%`],
      ['Cost', `${res.cost} essence`],
      ['', 'level and xp are kept; check it with `v animal ' + a.id + '`'],
    ], 0x9b59b6)] });
  },
};