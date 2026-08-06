const db = require('../db');
const { embed, success, error } = require('../utils/embed');

module.exports = {
  name: 'garden',
  helpCategory: 'Pets',
  helpArgs: '[buy|sell] [count]',
  aliases: ['snails', 'snail', 'snailgarden'],
  description: 'snail garden — buy snails and they breed over time (sell them for profit)',
  execute(message, args) {
    const userId = message.author.id;
    const action = (args[0] || '').toLowerCase();
    const count = args[1] ? parseInt(args[1], 10) : 1;

    if (action === 'buy') {
      const n = !isNaN(count) && count > 0 ? Math.min(count, db.SNAIL_DAILY_LIMIT) : 1;
      const r = db.buySnails(userId, n);
      if (!r.ok) {
        if (r.reason === 'limit') return message.channel.send({ embeds: [error(`daily buy limit is **${db.SNAIL_DAILY_LIMIT}** snails — you can buy **${r.remaining}** more today`)] });
        if (r.reason === 'capacity') return message.channel.send({ embeds: [error(`your garden is full (**${r.capacity}** snails max)`)] });
        if (r.reason === 'coins') return message.channel.send({ embeds: [error(`buying **${n}** snail(s) costs **${r.cost}** coins (you have **${r.balance}**)`)] });
        return message.channel.send({ embeds: [error('invalid amount')] });
      }
      return message.channel.send({ embeds: [success(`bought **${r.bought}** snail(s) for **${r.cost}** coins — you have **${db.getSnailInfo(userId).snails}**\nbuy **${r.remaining}** more today at **${db.SNAIL_PRICE}** coins each`)] });
    }

    if (action === 'sell') {
      const n = !isNaN(count) && count > 0 ? count : 1;
      const r = db.sellSnails(userId, n);
      if (!r.ok) return message.channel.send({ embeds: [error('you have no snails to sell')] });
      return message.channel.send({ embeds: [success(`sold **${r.sold}** snail(s) for **${r.coins}** coins — you have **${db.getSnailInfo(userId).snails}** left`)] });
    }

    if (action !== '') {
      return message.channel.send({ embeds: [error('usage: `v garden` · `v garden buy <count>` · `v garden sell <count>`')] });
    }

    const bred = db.breedSnails(userId);
    const info = db.getSnailInfo(userId);

    let nextIn = '—';
    if (info.snails < info.capacity && info.snails > 0) {
      const elapsed = Math.floor(Date.now() / 1000) - (info.lastTick || Math.floor(Date.now() / 1000));
      const until = db.SNAIL_BREED_SECONDS ? db.SNAIL_BREED_SECONDS - elapsed : 0;
      nextIn = until > 0 ? `**${Math.ceil(until / 3600)}h**` : 'now';
    }

    const fields = [
      ['Snails', `**${info.snails}** / ${info.capacity}`],
      ['Breeding', `1 baby per snail per 24h, up to capacity\nnext baby in: ${nextIn}`],
      ['Today', `bought **${info.boughtToday}** — **${info.buyLimitToday}** more available at **${db.SNAIL_PRICE}** coins each`],
      ['Sell value', `**${info.snails * db.SNAIL_SELL_PRICE}** coins (${db.SNAIL_SELL_PRICE} each)`],
    ];
    if (bred.bred > 0) fields.unshift(['', `🐣 **${bred.bred}** baby snail(s) hatched!`]);

    message.channel.send({ embeds: [embed('Snail Garden', fields, 0x2b2d31)] });
  },
};
