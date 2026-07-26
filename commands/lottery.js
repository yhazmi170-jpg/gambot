const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');

const TICKET_PRICE = 10;

module.exports = {
  name: 'lottery',
  helpCategory: 'Games',
  helpArgs: 'buy <amount>',
  aliases: ['lotto', 'lot'],
  execute(message, args) {
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'buy') {
      const amount = parseAmount(args[1]);
      if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('how many tickets?')] });
      const cost = amount * TICKET_PRICE;

      const user = db.ensureUser(message.author.id);
      if (user.balance < cost) return message.channel.send({ embeds: [error('not enough coins')] });

      db.addBalance(message.author.id, -cost);
      db.addTicket(message.author.id, amount);

      const total = db.totalTickets().total;
      message.channel.send({
        embeds: [success(`bought **${amount}** lottery tickets for **${cost}** ${config.currency}\ntotal tickets in pot: **${total}**`)],
      });
    } else if (sub === 'stats' || sub === 'info') {
      const total = db.totalTickets().total;
      const entries = db.getLottery();
      message.channel.send({
        embeds: [embed('🎟️ Lottery', [
          ['Total Tickets', String(total)],
          ['Ticket Price', `${TICKET_PRICE} ${config.currency}`],
          ['Players', String(entries.length)],
          ['Draw', 'every hour'],
        ])],
      });
    } else {
      const user = db.ensureUser(message.author.id);
      if (!user) return message.channel.send({ embeds: [embed('🎟️ Lottery', [['info', 'use `v lottery buy <amount>` to buy tickets']])] });
      const entry = db.getLottery().find(e => e.user_id === message.author.id);
      message.channel.send({
        embeds: [embed('🎟️ Your Tickets', [
          ['Tickets', String(entry ? entry.tickets : 0)],
          ['Use', '`v lottery buy <amount>` to buy more\n`v lottery stats` to see the pot'],
        ])],
      });
    }
  },
};
