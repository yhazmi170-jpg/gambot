const db = require('../db');
const config = require('../config');
const { error, success } = require('../utils/embed');
const { parseGuildId, listEmbed } = require('../utils/serverAccess');

// v psu — unlock a server. Gambot can be added to a server by anyone, so every
// server it is not explicitly approved in starts LOCKED and its members get a
// "run v psu here" notice instead of commands.
//
//   v psu           unlock this server
//   v psu <id>      unlock that server, from any server (paste an id from list)
//   v psu list      every server we know about, with ids
//
// Owner only. DMs are never locked, and the owner is never locked.
module.exports = {
  name: 'psu',
  aliases: ['pendingserver', 'pserverunlock', 'unlockserver'],
  helpCategory: 'Admin',
  description: 'Owner only: unlock a server so its members can use Gambot (run with no id = this server)',
  helpArgs: '[list | server id]',

  async execute(message, args) {
    if (message.author.id !== config.ownerId) {
      return message.reply({ embeds: [error('This command is owner only.')] });
    }

    const arg = args && args[0] !== undefined ? String(args[0]) : '';
    const lowered = arg.toLowerCase();

    if (lowered === 'list' || lowered === 'status') {
      return message.reply({ embeds: [listEmbed()] });
    }

    let id;
    let label;
    if (!arg) {
      if (!message.guild) return message.reply({ embeds: [error('Run `v psu` inside a server, or `v psu <server id>` to pick one from `v psu list`.')] });
      id = message.guild.id;
      label = message.guild.name;
    } else {
      id = parseGuildId(arg);
      if (!id) {
        return message.reply({ embeds: [error('That is not a server id. Copy one from `v psu list`, or run `v psu` with no id to unlock this server.')] });
      }
      const known = db.getServerAccess(id);
      label = (known && known.guildName) || '';
    }

    const res = db.activateServer(id, message.author.id, label);
    if (res.already) {
      return message.reply({ embeds: [success(`\`${id}\` is already unlocked${res.record.activatedBy ? ` by \`${res.record.activatedBy}\`` : ''}.`)] });
    }
    return message.reply({ embeds: [success(
      `Unlocked \`${id}\`${res.record.guildName ? ` (${res.record.guildName})` : ''}. Members there can use the bot now.`,
    )] });
  },
};
