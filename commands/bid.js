const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'bid',
  helpCategory: 'Pets',
  helpArgs: '<auction_id> <amount>',
  description: 'place a bid on an auction — highest bid wins when time runs out',
  execute(message, args) {
    const userId = message.author.id;
    const aucId = args[0];
    const amount = parseInt(args[1], 10);
    if (!aucId || !amount || amount <= 0) return message.channel.send({ embeds: [error('usage: `v bid <auction_id> <amount>` — see `v auction list`')] });
    const res = db.placeBid(aucId, userId, amount);
    if (!res.ok) {
      const reasons = {
        notfound: 'auction not found',
        self: 'you cannot bid on your own auction',
        low: `bid too low — minimum bid is **${(res.min || 0).toLocaleString()}**`,
        coins: 'you do not have enough coins',
        ended: 'that auction has ended',
      };
      return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not place bid')] });
    }
    return message.channel.send({ embeds: [embed('Bid Placed', [
      ['Auction', `\`${aucId}\``],
      ['Your bid', `**${amount.toLocaleString()}** ${config.currency}`],
      ['Note', 'if outbid, your coins are refunded automatically'],
    ], 0x57f287)] });
  },
};