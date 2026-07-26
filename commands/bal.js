const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'bal',
  aliases: ['balance', 'wallet', 'cash'],
  execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    const user = db.ensureUser(target.id);
    message.channel.send({
      embeds: [embed('💰 Balance', [
        ['User', `<@${target.id}>`],
        [config.currency.charAt(0).toUpperCase() + config.currency.slice(1), `**${user.balance.toLocaleString()}**`],
        ['Total Gambled', user.total_gambled ? user.total_gambled.toLocaleString() : '0'],
        ['Total Won', user.total_won ? user.total_won.toLocaleString() : '0'],
      ])],
    });
  },
};
