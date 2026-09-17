const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'dice',
  helpCategory: 'Games',
  helpArgs: '<amount> over/under <num>',
  description: 'over/under dice roll',
  aliases: ['roll', 'diceroll'],
  execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

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

    
    const isOver = pred[0] === 'o';
    let roll, win;
      roll = Math.floor(Math.random() * 100) + 1;
      win = isOver ? roll > num : roll < num;
    }

    if (win) {
      // lucky removed - fixed payout mult 98 / (isOver ? (100 - num) : (num - 1));
      const payout = Math.floor(amount * mult);
      const paid = db.payWin(message.author.id, payout);
      message.channel.send(`🎲 **${roll}** — won **${paid}** (bet **${amount}** → ${mult.toFixed(2)}x)`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`🎲 **${roll}** — lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`🎲 **${roll}** — lost **${amount}**`);
    }
  },
};
