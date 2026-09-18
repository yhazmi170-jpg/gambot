const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');

const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const black = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

module.exports = {
  name: 'roulette',
  helpCategory: 'Games',
  helpArgs: '<amount> <red/black/green/num>',
  description: 'spin the roulette wheel',
  aliases: ['roul'],
  execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const bet = args.slice(1).join(' ').toLowerCase();
    if (!bet) return message.channel.send({ embeds: [error('bet on red, black, green, or 0-36')] });

    const result = Math.floor(Math.random() * 37);
    const color = result === 0 ? 'green' : red.includes(result) ? 'red' : 'black';
    const emoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';
    let won = false;
    let payout = 0;
    const mult = 1;

    if (bet === 'red' && color === 'red') { won = true; payout = amount * 2 * mult; }
    else if (bet === 'black' && color === 'black') { won = true; payout = amount * 2 * mult; }
    else if (bet === 'green' && color === 'green') { won = true; payout = amount * 14 * mult; }
    else if (!isNaN(parseInt(bet)) && parseInt(bet) === result) { won = true; payout = amount * 36 * mult; }

    if (won) {
      const paid = db.payWin(message.author.id, payout - amount);
      message.channel.send(`${emoji} **${result}** — won **${paid}**`);
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) { db.addBalance(message.author.id, refund); message.channel.send(`${emoji} **${result}** — lost **${amount}** (🛡️ **${refund}** refunded)`); }
      else message.channel.send(`${emoji} **${result}** — lost **${amount}**`);
    }
  },
};