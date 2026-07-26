const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config.json');

module.exports = {
  name: 'bank',
  aliases: ['banking'],
  execute(message, args) {
    const uid = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    const user = db.ensureUser(uid);

    if (!sub || sub === 'bal' || sub === 'balance') {
      return message.channel.send({
        embeds: [embed('🏦 Bank', [
          ['Wallet', `**${user.balance}** ${config.currency}`],
          ['Bank', `**${user.bank}** ${config.currency}`],
          ['Loan', user.loan > 0 ? `**${user.loan}** ${config.currency} (outstanding)` : 'None'],
          ['Net Worth', `**${user.balance + user.bank - user.loan}** ${config.currency}`],
        ], 0x2b2d31)],
      });
    }

    if (sub === 'deposit' || sub === 'dep') {
      let amount;
      if ((args[1] || '').toLowerCase() === 'all') amount = user.balance;
      else amount = parseAmount(args[1]);
      if (!amount || amount <= 0) return message.channel.send({ embeds: [error('usage: `v bank deposit <amount/all>`')] });
      if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money in wallet')] });
      db.bankDeposit(uid, amount);
      return message.channel.send({ embeds: [success(`deposited **${amount}** ${config.currency} into your bank`)] });
    }

    if (sub === 'withdraw' || sub === 'with') {
      let amount;
      if ((args[1] || '').toLowerCase() === 'all') amount = user.bank;
      else amount = parseAmount(args[1]);
      if (!amount || amount <= 0) return message.channel.send({ embeds: [error('usage: `v bank withdraw <amount/all>`')] });
      if (user.bank < amount) return message.channel.send({ embeds: [error('not enough money in bank')] });
      db.bankWithdraw(uid, amount);
      return message.channel.send({ embeds: [success(`withdrew **${amount}** ${config.currency} from your bank`)] });
    }

    if (sub === 'loan' || sub === 'loans') {
      const sub2 = (args[1] || '').toLowerCase();

      if (sub2 === 'pay' || sub2 === 'repay') {
        if (!user.loan) return message.channel.send({ embeds: [error("you don't have a loan")] });
        let amount;
        if ((args[2] || '').toLowerCase() === 'all') amount = Math.min(user.balance, user.loan);
        else amount = parseAmount(args[2]);
        if (!amount || amount <= 0) return message.channel.send({ embeds: [error('usage: `v bank loan pay <amount/all>`')] });
        if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });
        const result = db.payLoan(uid, amount);
        if (!result) return message.channel.send({ embeds: [error('something went wrong')] });
        const msg = result.cleared
          ? `paid off your loan! 🎉 You repaid **${result.paid}** ${config.currency} in total.`
          : `paid **${result.paid}** ${config.currency}. **${result.remaining}** remaining.`;
        return message.channel.send({ embeds: [success(msg)] });
      }

      if (user.loan > 0) {
        const elapsed = Math.floor(Date.now() / 1000) - user.loan_time;
        const days = Math.floor(elapsed / 86400);
        return message.channel.send({
          embeds: [embed('📄 Loan', [
            ['Outstanding', `**${user.loan}** ${config.currency}`],
            ['Taken', `${days} day(s) ago`],
            ['Repay', `\`v bank loan pay <amount/all>\``],
          ], 0xfee75c)],
        });
      }

      let amount;
      if ((args[1] || '').toLowerCase() === 'max') amount = Infinity;
      else amount = parseAmount(args[1]);
      if (!amount || amount <= 0) return message.channel.send({ embeds: [error('usage: `v bank loan <amount/max>`')] });

      const result = db.takeLoan(uid, amount);
      if (!result) return message.channel.send({ embeds: [error("you already have a loan or can't borrow that much")] });

      return message.channel.send({
        embeds: [success(`received **${result.received}** ${config.currency}\nYou owe **${result.owed}** (${Math.round(result.interest * 100)}% interest)`)] });
    }

    message.channel.send({ embeds: [embed('🏦 Bank', [
      ['Commands', [
        `\`v bank\` — check bank balance`,
        `\`v bank deposit <amount/all>\` — deposit money`,
        `\`v bank withdraw <amount/all>\` — withdraw money`,
        `\`v bank loan <amount/max>\` — take a loan`,
        `\`v bank loan pay <amount/all>\` — repay loan`,
      ].join('\n')],
      ['Loan Terms', `Borrow up to **2x** your net worth with **${Math.round(db.LOAN_INTEREST * 100)}%** interest (one-time fee).`],
      ['Note', 'Bank money is safe — can\'t be gambled, robbed, or lost.'],
    ], 0x2b2d31)] });
  },
};
