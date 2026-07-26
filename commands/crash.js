const db = require('../db');
const { error, parseAmount } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'crash',
  helpCategory: 'Games',
  helpArgs: '<amount> <multiplier>',
  aliases: ['crsh'],
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

    const target = parseFloat(args[1]);
    if (isNaN(target) || target < 1.1) {
      return message.channel.send({ embeds: [error('set a cashout multiplier (min 1.1x)')] });
    }

    const lucky = db.ensureUser(message.author.id).lucky;
    const crashPoint = lucky ? target + 10 + Math.random() * 20 : 1 + Math.random() * 9;
    const win = crashPoint >= target;
    const payout = win ? Math.floor(amount * (lucky ? target * 3 : target)) : 0;
    const net = payout - amount;

    if (win) {
      db.addBalance(message.author.id, net);
      db.addWon(message.author.id, payout);
      message.channel.send(`📈 crashed at **${crashPoint.toFixed(2)}x** — cashed out at **${target}x** for **${payout}** (+**${net}**)`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`📈 crashed at **${crashPoint.toFixed(2)}x** — set **${target}x**... lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`📈 crashed at **${crashPoint.toFixed(2)}x** — you set **${target}x**... lost **${amount}**`);
    }
  },
};
