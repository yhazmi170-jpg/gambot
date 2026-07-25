const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'enable',
  aliases: ['en'],
  execute(message, args) {
    if (!message.member?.permissions?.has('Administrator')) {
      return message.channel.send({ embeds: [error('you need admin perms to enable commands')] });
    }
    if (!message.guild) return message.channel.send({ embeds: [error('this only works in servers')] });

    const target = (args[0] || '').toLowerCase();
    if (!target) return message.channel.send({ embeds: [error('usage: `v enable all` or `v enable <command>`')] });

    db.enableCommand(message.guild.id, target);
    message.channel.send({ embeds: [success(`enabled \`${target}\` in this server`)] });
  },
};
