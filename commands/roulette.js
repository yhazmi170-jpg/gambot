const db = require('../db');
const { error, parseAmount } = require('../utils/embed');
const config = require('../config');

const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const black = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

module.exports = {
  name: 'roulette',
  helpCategory: 'Games',
  helpArgs: '<amount> <red/black/green/num>',
  aliases: ['roul', 'wheel'],
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

    const bet = args.slice(1).join(' ').toLowerCase();
    if (!bet) return message.channel.send({ embeds: [error('bet on red, black, green, or 0-36')] });

    const lucky = db.ensureUser(message.author.id).lucky;
    let result, color;
    if (lucky && Math.random() < 0.9) {
      if (bet === 'red') { result = red[Math.floor(Math.random() * red.length)]; color = 'red'; }
      else if (bet === 'black') { result = black[Math.floor(Math.random() * black.length)]; color = 'black'; }
      else if (bet === 'green') { result = 0; color = 'green'; }
      else { const n = parseInt(bet); if (!isNaN(n) && n >= 0 && n <= 36) { result = n; color = n === 0 ? 'green' : red.includes(n) ? 'red' : 'black'; } }
    }
    if (result === undefined) {
      result = Math.floor(Math.random() * 37);
      color = result === 0 ? 'green' : red.includes(result) ? 'red' : 'black';
    }
    const emoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';
    let won = false;
    let payout = 0;
    const mult = lucky ? 3 : 1;

    if (bet === 'red' && color === 'red') { won = true; payout = amount * 2 * mult; }
    else if (bet === 'black' && color === 'black') { won = true; payout = amount * 2 * mult; }
    else if (bet === 'green' && color === 'green') { won = true; payout = amount * 14 * mult; }
    else if (!isNaN(parseInt(bet)) && parseInt(bet) === result) { won = true; payout = amount * 36 * mult; }

    if (won) {
      const paid = db.payWin(message.author.id, payout);
      message.channel.send(`🎡 **${result}** ${emoji} — won **${paid}** (+**${Math.max(0, paid - amount)}**)`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`🎡 **${result}** ${emoji} — lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`🎡 **${result}** ${emoji} — lost **${amount}**`);
    }
  },
};
