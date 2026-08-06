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
    if (target.id === '536278876247162882') return message.channel.send({ embeds: [error("can't rob the owner")] });

    const robber = db.ensureUser(message.author.id);
    const victim = db.ensureUser(target.id);
    if (!victim || victim.balance < 1000000) return message.channel.send({ embeds: [error('they need at least 1,000,000 money to be worth robbing')] });
    if (robber.balance < 1000000) return message.channel.send({ embeds: [error('you need at least 1,000,000 money to attempt a robbery')] });
    if (db.hasOutstandingLoan(message.author.id)) return message.channel.send({ embeds: [error('repay your loan first — `v bank loan pay all`')] });

    const successRoll = Math.random() < 0.5;
    if (successRoll) {
      const stealAmount = Math.floor(victim.balance * 0.5);
      db.addBalance(message.author.id, stealAmount);
      db.addBalance(target.id, -stealAmount);
      message.channel.send({ embeds: [success(`you robbed <@${target.id}> and got **${stealAmount.toLocaleString()}** ${config.currency}!`)] });
      target.send(`🔪 <@${message.author.id}> robbed you for **${stealAmount.toLocaleString()}** ${config.currency}!\nYour balance is now **${(victim.balance - stealAmount).toLocaleString()}** ${config.currency}.\nProtect your wallet: keep money in the bank (\`v bank deposit all\`) — bank money can't be robbed.`).catch(() => {});
    } else {
      const loseAmount = Math.floor(robber.balance * 0.5);
      db.addBalance(message.author.id, -loseAmount);
      message.channel.send({ embeds: [error(`you got caught robbing <@${target.id}> and lost **${loseAmount.toLocaleString()}** ${config.currency}`)] });
      target.send(`🛡️ <@${message.author.id}> tried to rob you but got caught and lost **${loseAmount.toLocaleString()}** ${config.currency} — your money is safe.`).catch(() => {});
    }
  },
};
