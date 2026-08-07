const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');
const { parseAmount } = require('../utils/embed');

module.exports = {
  name: 'freebet',
  helpCategory: 'Economy',
  helpArgs: '[amount]',
  description: 'get 500 free house coins daily and gamble them (winnings are real)',
  aliases: ['fb'],
  execute(message, args) {
    const userId = message.author.id;
    if (!args.length) {
      const claim = db.claimFreeBet(userId);
      if (claim.already) {
        return message.channel.send({ embeds: [embed('Free Bets', [
          ['Already claimed', `come back tomorrow (cap **${db.FREE_BET_MAX.toLocaleString()}**)`],
          ['Balance', `**${claim.total.toLocaleString()}** free coins available`],
          ['Play', '`v freebet <amount>` to gamble them — winnings go to your real balance'],
        ])] });
      }
      return message.channel.send({ embeds: [embed('Free Bets', [
        ['Claimed', `+**${claim.granted.toLocaleString()}** free coins`],
        ['Balance', `**${claim.total.toLocaleString()}** free coins (cap ${db.FREE_BET_MAX.toLocaleString()})`],
        ['Play', '`v freebet <amount>` to gamble them. lose = house money gone, win = real profit'],
      ])] });
    }
    const amount = parseAmount(args[0]);
    if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('give a valid amount, e.g. `v freebet 500`')] });
    const free = db.getFreeBet(userId);
    if (free < amount) return message.channel.send({ embeds: [error(`you only have **${free.toLocaleString()}** free coins — claim more with \`v freebet\` (or lower the amount)`)] });
    if (!db.useFreeBet(userId, amount)) return message.channel.send({ embeds: [error('could not place free bet')] });
    const won = Math.random() < 0.5;
    if (won) {
      const profit = amount;
      db.payWin(userId, profit);
      return message.channel.send({ embeds: [embed('Free Bet WIN', [
        ['Bet', `**${amount.toLocaleString()}** free coins`],
        ['Winnings', `**${Math.floor(profit)}** real ${config.currency} paid to your balance (stake was house money)`],
        ['Free balance', `${db.getFreeBet(userId).toLocaleString()} left`],
      ], 0x57f287)] });
    }
    return message.channel.send({ embeds: [embed('Free Bet LOST', [
      ['Bet', `**${amount.toLocaleString()}** free coins lost`],
      ['Balance', `**${db.getFreeBet(userId).toLocaleString()}** free coins left`],
    ], 0xed4245)] });
  },
};