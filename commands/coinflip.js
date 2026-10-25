const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'coinflip',
  helpCategory: 'Games',
  helpArgs: '<amount> [heads/tails]',
  description: '50/50 coinflip with suspense',
  aliases: ['cf', 'coin', 'flip'],
  async execute(message, args) {
    let betArg = args[0];
    let sideArg = args[1];

    // Support both orderings: `v cf 100 h` and `v cf h 100`
    if (['heads', 'tails', 'h', 't', 'head', 'tail'].includes((args[0] || '').toLowerCase())) {
      sideArg = args[0];
      betArg = args[1];
    }

    const { amount, error: betError } = db.parseBet(message.author.id, betArg);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const choice = (sideArg || 'heads').toLowerCase();
    if (!['heads', 'tails', 'h', 't', 'head', 'tail'].includes(choice)) {
      return message.channel.send({ embeds: [error('choose heads or tails')] });
    }

    const side = choice[0] === 'h' ? 'heads' : 'tails';
    const authorName = message.author.username || 'Player';
    const currency = config.currency;

    const result = Math.random() < 0.5 ? side : (side === 'heads' ? 'tails' : 'heads');
    const win = result === side;
    const mult = 1;

    const COIN_SPIN = '<a:coinflip:1563711499820605506>';
    const initialMsg = await message.channel.send(
      `🪙 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and picked **${side}**\nThe coin spins... ${COIN_SPIN}`
    );

    const isTest = process.env.TEST === '1' || (process.env.DB_PATH && process.env.DB_PATH.startsWith('/tmp'));
    const delay = isTest ? 10 : 2200;
    await new Promise(r => setTimeout(r, delay));

    if (win) {
      const profit = amount * mult;
      const paid = db.payWin(message.author.id, profit);
      const text = `🪙 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and picked **${side}**\nThe coin spins... 🪙 landed on **${result}**! and won **${paid.toLocaleString()}** ${currency}!`;
      if (initialMsg && typeof initialMsg.edit === 'function') {
        await initialMsg.edit(text).catch(() => {});
      }
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      let text = '';
      if (refund > 0) {
        db.addBalance(message.author.id, refund);
        text = `🪙 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and picked **${side}**\nThe coin spins... 🪙 landed on **${result}**... and lost **${amount.toLocaleString()}** ${currency}! (🛡️ **${refund.toLocaleString()}** refunded)`;
      } else {
        text = `🪙 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and picked **${side}**\nThe coin spins... 🪙 landed on **${result}**... and lost **${amount.toLocaleString()}** ${currency}!`;
      }
      if (initialMsg && typeof initialMsg.edit === 'function') {
        await initialMsg.edit(text).catch(() => {});
      }
    }
  },
};
