const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'crash',
  helpCategory: 'Games',
  helpArgs: '<amount> <multiplier>',
  description: 'cash out before it crashes',
  aliases: ['crsh'],
  execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const target = parseFloat(args[1]);
    if (isNaN(target) || target < 1.1) {
      return message.channel.send({ embeds: [error('set a cashout multiplier (min 1.1x)')] });
    }

    const factor = db.getBalanceFactor(message.author.id);
    const realMult = db.effectiveMult(message.author.id, target);
    if (factor < 1) {
      message.channel.send(`⚠️ **balance cut active** — at your balance, a **${target}x** cashout pays **${realMult}x**`).catch(() => {});
    }

    const lucky = db.ensureUser(message.author.id).lucky;
    const crashPoint = lucky ? target + 10 + Math.random() * 20 : 0.99 / (1 - Math.random());
    const win = crashPoint >= target;
    const payout = win ? Math.floor(amount * (lucky ? target * 3 : target)) : 0;
    const net = payout - amount;

    if (win) {
      const paid = db.payWin(message.author.id, net);
      const gotMult = ((amount + paid) / amount).toFixed(2);
      const cut = paid < net ? ` — got **${gotMult}x** (balance cut)` : '';
      message.channel.send(`📈 crashed at **${crashPoint.toFixed(2)}x** — cashed out at **${target}x** for **${amount + paid}** (+**${paid}**)${cut}`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`📈 crashed at **${crashPoint.toFixed(2)}x** — set **${target}x**... lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`📈 crashed at **${crashPoint.toFixed(2)}x** — you set **${target}x**... lost **${amount}**`);
    }
  },
};
