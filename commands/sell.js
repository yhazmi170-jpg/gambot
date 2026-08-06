const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'sell',
  helpCategory: 'Pets',
  helpArgs: '<id|species|rarity|all> [count]',
  description: 'sell an animal by id, or sell a species/rarity (or everything) from your zoo',
  execute(message, args) {
    const userId = message.author.id;
    const raw = args[0];
    if (!raw) return message.channel.send({ embeds: [error('usage: `v sell <id>` · `v sell <species|rarity> [count]`')] });

    const id = parseInt(raw, 10);

    if (!isNaN(id)) {
      const animal = db.getAnimal(id);
      if (!animal || animal.user_id !== userId) return message.channel.send({ embeds: [error('animal not found')] });
      const price = db.sellPrice(animal);
      const team = db.getTeam(userId);
      const onTeam = team && (team.slot1 === animal.id || team.slot2 === animal.id || team.slot3 === animal.id);
      if (onTeam) {
        const s = [1, 2, 3].find(sl => team[`slot${sl}`] === animal.id);
        if (s) db.removeFromTeam(userId, s);
      }
      db.removeAnimal(id);
      db.addBalance(userId, price);
      return message.channel.send({
        embeds: [embed('Sold', [
          ['Animal', `**${animal.species}** (Lv.${animal.level})`],
          ['Price', `**${price}** ${config.currency}`],
        ], 0x57f287)],
      });
    }

    const query = raw.toLowerCase();
    const count = args[1] ? parseInt(args[1], 10) : null;
    if (count && isNaN(count)) return message.channel.send({ embeds: [error('usage: `v sell <species|rarity> [count]`')] });

    const animals = db.getUserAnimals(userId);
    const team = db.getTeam(userId);
    const teamIds = team ? new Set([team.slot1, team.slot2, team.slot3].filter(Boolean)) : new Set();
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const matches = animals.filter(a => {
      if (query === 'all') return true;
      if (rarities.includes(query)) return a.rarity === query;
      return a.species.toLowerCase() === query || a.species.toLowerCase().startsWith(query);
    });
    const targets = count ? matches.slice(0, count) : matches;

    let sold = 0;
    let coins = 0;
    let skipped = 0;
    for (const a of targets) {
      if (teamIds.has(a.id)) { skipped++; continue; }
      coins += db.sellPrice(a);
      db.removeAnimal(a.id);
      sold++;
    }

    if (!sold) {
      let msg = `no animals matched \`${raw}\``;
      if (skipped > 0) msg += ` — ${skipped} matched animal(s) are on your battle team and were skipped`;
      return message.channel.send({ embeds: [error(msg)] });
    }

    db.addBalance(userId, coins);
    const lines = [`sold **${sold}** animal(s) for **${coins}** ${config.currency}`, `balance: **${db.getBalance(userId)}** ${config.currency}`];
    if (skipped > 0) lines.push(`${skipped} team animal(s) were skipped`);
    message.channel.send({ embeds: [success(lines.join('\n'))] });
  },
};
