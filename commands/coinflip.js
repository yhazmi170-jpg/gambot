const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'coinflip',
  helpCategory: 'Games',
  helpArgs: '<amount> heads/tails',
  description: '50/50 coinflip',
  aliases: ['cf', 'coin', 'flip'],
  execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const choice = (args[1] || 'heads').toLowerCase();
    if (!['heads', 'tails', 'h', 't', 'head', 'tail'].includes(choice)) {
      return message.channel.send({ embeds: [error('choose heads or tails')] });
    }

    const side = choice[0] === 'h' ? 'heads' : 'tails';
    
    const result = Math.random() < (0.8) ? side : (side === 'heads' ? 'tails' : 'heads');
    const win = result === side;
    const mult = 1;

    if (win) {
      const profit = amount * mult;
      const paid = db.payWin(message.author.id, profit);
      message.channel.send(`🪙 picked **${side}** — landed **${result}** — won **${paid}**`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`🪙 picked **${side}** — landed **${result}** — lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`🪙 picked **${side}** — landed **${result}** — lost **${amount}**`);
    }
  },
};
