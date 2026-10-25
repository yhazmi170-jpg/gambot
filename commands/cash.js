const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'cash',
  helpCategory: 'Economy',
  helpArgs: '[user]',
  description: 'check your cash balance',
  aliases: ['money'],
  execute(message, args) {
    let target = message.author;
    if (message.mentions?.users?.first && message.mentions.users.first()) {
      target = message.mentions.users.first();
    } else if (args[0]) {
      const cleanId = args[0].replace(/[<@!>]/g, '');
      const fetched = message.client?.users?.cache?.get(cleanId);
      if (fetched) target = fetched;
    }

    if (target.bot) {
      return message.channel.send({ embeds: [error('bots have no money')] });
    }

    const viewingOther = target.id !== message.author.id;
    if (viewingOther && !config.isOwner(message.author.id)) {
      return message.channel.send({ embeds: [error('you can only check your own balance — `v cash`')] });
    }

    const user = db.ensureUser(target.id);
    if (!user) return message.channel.send({ embeds: [error('user not found')] });

    const authorName = target.username || 'Player';
    const currency = config.currency;

    message.channel.send(`💵 **| ${authorName}**, you currently have **__${user.balance.toLocaleString()}__ ${currency}!**`);
  },
};
