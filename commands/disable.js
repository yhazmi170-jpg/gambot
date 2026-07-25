const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'disable',
  aliases: ['dis'],
  execute(message, args) {
    if (!message.member?.permissions?.has('Administrator')) {
      return message.channel.send({ embeds: [error('you need admin perms to disable commands')] });
    }
    if (!message.guild) return message.channel.send({ embeds: [error('this only works in servers')] });

    const target = (args[0] || '').toLowerCase();
    if (!target) return message.channel.send({ embeds: [error('usage: `v disable all` or `v disable <command>`')] });

    db.disableCommand(message.guild.id, target);
    message.channel.send({ embeds: [success(`disabled \`${target}\` in this server`)] });
  },
};
