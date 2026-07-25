const db = require('../db');
const { error, parseAmount } = require('../utils/embed');
const config = require('../config.json');

module.exports = {
  name: 'dice',
  aliases: ['roll', 'diceroll'],
  execute(message, args) {
    let amount;
    if ((args[0] || '').toLowerCase() === 'all') {
      const u = db.ensureUser(message.author.id);
      amount = Math.min(u.balance, db.getMaxBet(message.author.id));
      if (amount <= 0) return message.channel.send({ embeds: [error('you have no money')] });
    } else {
      amount = parseAmount(args[0]);
      if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('bet an amount or use `all`')] });
    }

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const pred = (args[1] || '').toLowerCase();
    if (!['over', 'under', 'o', 'u'].includes(pred)) {
      return message.channel.send({ embeds: [error('choose over or under')] });
    }

    const num = parseInt(args[2]);
    if (isNaN(num) || num < 2 || num > 98) {
      return message.channel.send({ embeds: [error('pick a number 2-98')] });
    }

    const lucky = db.ensureUser(message.author.id).lucky;
    const isOver = pred[0] === 'o';
    let roll, win;
    if (lucky) {
      win = Math.random() < 0.9;
      roll = win ? (isOver ? num + 1 + Math.floor(Math.random() * (99 - num)) : Math.floor(Math.random() * (num - 1)) + 1) : (isOver ? Math.floor(Math.random() * num) + 1 : num + 1 + Math.floor(Math.random() * (99 - num)));
    } else {
      roll = Math.floor(Math.random() * 100) + 1;
      win = isOver ? roll > num : roll < num;
    }

    if (win) {
      const mult = lucky ? 98 * 3 / (isOver ? (100 - num) : (num - 1)) : 98 / (isOver ? (100 - num) : (num - 1));
      const payout = Math.floor(amount * mult);
      db.addBalance(message.author.id, payout);
      db.addWon(message.author.id, payout);
      message.channel.send(`🎲 **${roll}** — won **${payout}** (bet **${amount}** → ${mult.toFixed(2)}x)`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`🎲 **${roll}** — lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`🎲 **${roll}** — lost **${amount}**`);
    }
  },
};
