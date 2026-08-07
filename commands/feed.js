const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'feed',
  helpCategory: 'Pets',
  helpArgs: '<id>',
  description: 'feed a pet (500 coins) for a +10% battle stats buff for 2 hours',
  aliases: ['food'],
  execute(message, args) {
    const userId = message.author.id;
    const id = parseInt(args[0], 10);
    if (!id) return message.channel.send({ embeds: [error('usage: `v feed <animal_id>`')] });
    const a = db.getAnimal(id);
    if (!a || a.user_id !== userId) return message.channel.send({ embeds: [error('animal not found')] });
    const user = db.ensureUser(userId);
    if ((user.balance || 0) < db.FEED_COST) return message.channel.send({ embeds: [error(`feeding costs **${db.FEED_COST.toLocaleString()}** ${config.currency}`)] });
    if (db.isFed(a)) {
      const mins = Math.ceil((a.fed_until - Math.floor(Date.now() / 1000)) / 60);
      return message.channel.send({ embeds: [error(`**${a.species}** is already fed — buff lasts ${mins} more min (feeding again adds time)`)] });
    }
    db.addBalance(userId, -db.FEED_COST);
    const res = db.feedAnimal(id);
    if (!res.ok) return message.channel.send({ embeds: [error('could not feed')] });
    return message.channel.send({ embeds: [embed('🍖 Fed!', [
      ['Pet', `${a.species} Lv.${a.level}`],
      ['Buff', '+10% attack/defense for **2 hours** (battle only)'],
      ['Cost', `${db.FEED_COST.toLocaleString()} ${config.currency}`],
    ], 0x57f287)] });
  },
};