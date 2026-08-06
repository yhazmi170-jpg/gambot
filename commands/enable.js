const db = require('../db');
const { embed, error, success } = require('../utils/embed');

function parseChannelId(message, args) {
  const joined = args.join(' ');
  const m = joined.match(/<#(\d+)>/) || joined.match(/in\s+(\d+)/);
  return m ? m[1] : null;
}

module.exports = {
  name: 'enable',
  aliases: ['en'],
  execute(message, args) {
    if (!message.member?.permissions?.has('Administrator')) {
      return message.channel.send({ embeds: [error('you need admin perms to enable commands')] });
    }
    if (!message.guild) return message.channel.send({ embeds: [error('this only works in servers')] });

    const target = (args[0] || '').toLowerCase();
    if (!target) return message.channel.send({ embeds: [error('usage: `v enable all` or `v enable <command>` or `v enable <command> #channel`')] });

    const channelId = parseChannelId(message, args);
    if (channelId) {
      db.enableChannelCommand(message.guild.id, channelId, target);
      return message.channel.send({ embeds: [success(`enabled \`${target}\` in <#${channelId}>`)] });
    }

    db.enableCommand(message.guild.id, target);
    message.channel.send({ embeds: [success(`enabled \`${target}\` in this server`)] });
  },
};
