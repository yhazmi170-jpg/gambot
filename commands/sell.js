const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'sell',
  description: 'sell an animal from your zoo',
  async execute(message, args) {
    const id = parseInt(args[0]);
    if (!id) return message.channel.send({ embeds: [require('../utils/embed').error('usage: `v sell <animal id>`')] });

    const animal = db.getAnimal(id);
    if (!animal || animal.user_id !== message.author.id) return message.channel.send({ embeds: [require('../utils/embed').error('animal not found')] });

    const price = db.sellPrice(animal);
    const team = db.getTeam(message.author.id);
    const onTeam = team && (team.slot1 === animal.id || team.slot2 === animal.id || team.slot3 === animal.id);
    if (onTeam) { const s = [1, 2, 3].find(sl => team[`slot${sl}`] === animal.id); if (s) db.removeFromTeam(message.author.id, s); }

    db.removeAnimal(id);
    db.addBalance(message.author.id, price);

    message.channel.send({
      embeds: [embed('💰 Sold', [
        ['Animal', `**${animal.species}** (Lv.${animal.level})`],
        ['Price', `**${price}** ${require('../config').currency}`],
      ], 0x57f287)],
    });
  },
};
