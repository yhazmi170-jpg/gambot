const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'bal',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'check your balance',
  aliases: ['balance', 'wallet', 'cash'],
  execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    const user = db.ensureUser(target.id);
    if (!user) return message.channel.send({ embeds: [error('user not found')] });
    message.channel.send({
      embeds: [embed('💰 Balance', [
        ['User', `<@${target.id}>`],
        [config.currency.charAt(0).toUpperCase() + config.currency.slice(1), `**${user.balance.toLocaleString()}**`],
        ['Bank', `**${user.bank.toLocaleString()}**`],
        ['Gems', `${user.gems} 💎`],
        ['Total Gambled', user.total_gambled ? user.total_gambled.toLocaleString() : '0'],
        ['Total Won', user.total_won ? user.total_won.toLocaleString() : '0'],
      ])],
    });
  },
};
