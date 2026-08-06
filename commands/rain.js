const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'rain',
  aliases: [],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'rain')) {
      return message.channel.send({ embeds: [error("you don't own the rain perk. buy it from the shop.")] });
    }
    if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });

    const amount = parseAmount(args[0]);
    if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('enter a valid amount')] });

    const sender = db.ensureUser(message.author.id);
    if (sender.balance < amount) return message.channel.send({ embeds: [error('you dont have enough money')] });
    if (db.hasOutstandingLoan(message.author.id)) return message.channel.send({ embeds: [error('repay your loan first — `v bank loan pay all`')] });

    const members = message.guild.members.cache.filter(m => !m.user.bot && m.id !== message.author.id);
    if (!members.size) return message.channel.send({ embeds: [error('no other members to rain on')] });

    const share = Math.floor(amount / members.size);
    if (share < 1) return message.channel.send({ embeds: [error('amount too small to split among members')] });

    db.addBalance(message.author.id, -amount);
    for (const [id] of members) db.addBalance(id, share);

    message.channel.send({
      embeds: [success(`🌧️ **${message.author.username}** rained **${amount.toLocaleString()}** ${config.currency}! ${members.size} online members each got **${share}** ${config.currency}`)],
    });
  },
};
