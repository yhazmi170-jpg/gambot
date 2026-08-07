const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'loan',
  helpCategory: 'Economy',
  helpArgs: '[take <amt> | shark <amt> | pay <amt>]',
  description: 'borrow coins (30% interest, max 2x your balance+bank) or hit the loan shark (50%, up to 2M)',
  aliases: ['borrow'],
  execute(message, args) {
    const userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    const u = db.ensureUser(userId);

    if (sub === 'take' || sub === 'get') {
      const amt = parseAmount(args[1]);
      if (isNaN(amt) || amt <= 0) return message.channel.send({ embeds: [error('usage: `v loan take <amount>`')] });
      const res = db.takeLoan(userId, amt);
      if (!res) return message.channel.send({ embeds: [error('you already have an outstanding loan — pay it off first with `v loan pay`')] });
      return message.channel.send({ embeds: [embed('🏦 Loan', [
        ['Received', `**${res.received.toLocaleString()}** ${config.currency}`],
        ['Owe back', `**${res.owed.toLocaleString()}** ${config.currency} (${Math.round(res.interest * 100)}% interest)`],
        ['Note', 'your winnings automatically go toward the loan'],
      ])] });
    }

    if (sub === 'shark') {
      const amt = parseAmount(args[1]);
      if (isNaN(amt) || amt <= 0) return message.channel.send({ embeds: [error('usage: `v loan shark <amount>`')] });
      const res = db.sharkLoan(userId, amt);
      if (!res) return message.channel.send({ embeds: [error('you already have an outstanding loan — or you can\'t take mob money right now')] });
      return message.channel.send({ embeds: [embed('🦈 Loan Shark', [
        ['Received', `**${res.received.toLocaleString()}** ${config.currency}`],
        ['Owe back', `**${res.owed.toLocaleString()}** ${config.currency} (${Math.round(res.interest * 100)}% interest)`],
        ['Warning', 'miss payments and it comes out of your winnings — the mob always gets paid'],
      ], 0xed4245)] });
    }

    if (sub === 'pay') {
      const amt = args[1] ? parseAmount(args[1]) : Math.min(u.balance, db.getLoan(userId));
      if (isNaN(amt) || amt <= 0) return message.channel.send({ embeds: [error('usage: `v loan pay [amount]`')] });
      const res = db.payLoan(userId, amt);
      if (!res) return message.channel.send({ embeds: [error('you have no loan to pay off')] });
      const msg = res.cleared
        ? `✅ loan cleared! you paid the final **${res.paid.toLocaleString()}** ${config.currency}.`
        : `paid **${res.paid.toLocaleString()}** ${config.currency} — **${res.remaining.toLocaleString()}** left.`;
      return message.channel.send({ embeds: [embed('🏦 Loan', [['', msg]])] });
    }

    const loan = db.getLoan(userId);
    const maxLoan = Math.floor((u.balance + (u.bank || 0)) * db.MAX_LOAN_MULT);
    const lines = loan > 0
      ? [`**${loan.toLocaleString()}** ${config.currency} owed — pay it off with \`v loan pay\``, '', 'winnings go toward the loan automatically']
      : [`no loan right now — you can borrow up to **${maxLoan.toLocaleString()}** ${config.currency}`, '', '`v loan take <amt>` (30% interest) · `v loan shark <amt>` (50%, up to 2M)'];
    return message.channel.send({ embeds: [embed('🏦 Loans', [
      ['Status', lines.join('\n')],
    ])] });
  },
};