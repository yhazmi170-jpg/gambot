const db = require('../db');
const { embed, error, success } = require('../utils/embed');

function parseChannelId(message, args) {
  const joined = args.join(' ');
  const m = joined.match(/<#(\d+)>/) || joined.match(/in\s+(\d+)/);
  return m ? m[1] : null;
}

module.exports = {
  name: 'disable',
  aliases: ['dis'],
  execute(message, args) {
    if (!message.member?.permissions?.has('Administrator')) {
      return message.channel.send({ embeds: [error('you need admin perms to disable commands')] });
    }
    if (!message.guild) return message.channel.send({ embeds: [error('this only works in servers')] });

    const target = (args[0] || '').toLowerCase();
    if (!target) return message.channel.send({ embeds: [error('usage: `v disable all` or `v disable <command>` or `v disable <command> #channel`')] });

    const channelId = parseChannelId(message, args);
    if (channelId) {
      db.disableChannelCommand(message.guild.id, channelId, target);
      return message.channel.send({ embeds: [success(`disabled \`${target}\` in <#${channelId}>`)] });
    }

    db.disableCommand(message.guild.id, target);
    message.channel.send({ embeds: [success(`disabled \`${target}\` in this server`)] });
  },
};
