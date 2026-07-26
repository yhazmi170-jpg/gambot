const db = require('../db');
const { error, parseAmount } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'coinflip',
  aliases: ['cf', 'coin', 'flip'],
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

    const choice = (args[1] || 'heads').toLowerCase();
    if (!['heads', 'tails', 'h', 't', 'head', 'tail'].includes(choice)) {
      return message.channel.send({ embeds: [error('choose heads or tails')] });
    }

    const side = choice[0] === 'h' ? 'heads' : 'tails';
    const lucky = db.ensureUser(message.author.id).lucky;
    const result = Math.random() < (lucky ? 0.9 : 0.5) ? side : (side === 'heads' ? 'tails' : 'heads');
    const win = result === side;
    const mult = lucky ? 3 : 1;

    if (win) {
      const profit = amount * mult;
      db.addBalance(message.author.id, profit);
      db.addWon(message.author.id, profit);
      message.channel.send(`🪙 **${result}** — won **${amount + profit}** (+**${profit}**)`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`🪙 **${result}** — lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`🪙 **${result}** — lost **${amount}**`);
    }
  },
};
