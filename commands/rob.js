const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'rob',
  aliases: ['steal'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'rob')) return message.channel.send({ embeds: [error('you need to buy the rob perk from the shop')] });

    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id || target.bot) return message.channel.send({ embeds: [error('mention a real user to rob')] });

    const robber = db.ensureUser(message.author.id);
    const victim = db.ensureUser(target.id);
    if (!victim || victim.balance < 1000) return message.channel.send({ embeds: [error('they have nothing worth stealing')] });
    if (robber.balance < 1000) return message.channel.send({ embeds: [error('you need at least 1,000 money to attempt a robbery')] });

    const successRoll = Math.random() < 0.5;
    if (successRoll) {
      const stealAmount = Math.floor(victim.balance * 0.5);
      db.addBalance(message.author.id, stealAmount);
      db.addBalance(target.id, -stealAmount);
      message.channel.send({ embeds: [success(`you robbed <@${target.id}> and got **${stealAmount.toLocaleString()}** ${config.currency}!`)] });
    } else {
      const loseAmount = Math.floor(robber.balance * 0.5);
      db.addBalance(message.author.id, -loseAmount);
      message.channel.send({ embeds: [error(`you got caught robbing <@${target.id}> and lost **${loseAmount.toLocaleString()}** ${config.currency}`)] });
    }
  },
};
