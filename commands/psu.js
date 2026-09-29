const db = require('../db');
const config = require('../config');
const { error, success } = require('../utils/embed');
const { parseGuildId, listEmbed } = require('../utils/serverAccess');

// v psu — unlock a server. Gambot can be added to a server by anyone, so every
// server it is not explicitly approved in starts LOCKED and its members get a
// "run v psu here" notice instead of commands.
//
//   v psu                unlock this server (global)
//   v psu offline        unlock this server LOCAL ONLY — v lb/v glb/v slb show only this server's members
//   v psu offline <id>   same, for that server, from any server
//   v psu <id>           unlock that server globally, from any server (paste an id from list)
//   v psu list           every server we know about, with ids
//
// Owner only. DMs are never locked, and the owner is never locked.
module.exports = {
  name: 'psu',
  aliases: ['pendingserver', 'pserverunlock', 'unlockserver'],
  helpCategory: 'Admin',
  description: 'Owner only: unlock a server (global), or `v psu offline` for a local-only server (leaderboards show only that server)',
  helpArgs: '[offline] [server id | list]',

  async execute(message, args) {
    if (message.author.id !== config.ownerId) {
      return message.reply({ embeds: [error('This command is owner only.')] });
    }

    const arg = args && args[0] !== undefined ? String(args[0]) : '';
    const lowered = arg.toLowerCase();
    const local = lowered === 'offline' || lowered === 'local';

    if (lowered === 'list' || lowered === 'status') {
      return message.reply({ embeds: [listEmbed()] });
    }

    let id;
    let label;
    let argForId = arg;
    if (local) {
      argForId = args && args[1] !== undefined ? String(args[1]) : '';
    }
    if (!argForId) {
      if (!message.guild) return message.reply({ embeds: [error('Run `v psu` inside a server, or `v psu <server id>` to pick one from `v psu list`.')] });
      id = message.guild.id;
      label = message.guild.name;
    } else {
      id = parseGuildId(argForId);
      if (!id) {
        return message.reply({ embeds: [error('That is not a server id. Copy one from `v psu list`, or run `v psu` with no id to unlock this server.')] });
      }
      const known = db.getServerAccess(id);
      label = (known && known.guildName) || '';
    }

    const mode = local ? 'offline' : 'active';
    const res = db.activateServer(id, message.author.id, label, mode);
    require('../utils/serverAccess').invalidateHiddenCache(); // leaderboard visibility must update NOW
    if (res.already) {
      const what = local ? 'local-only' : 'global';
      return message.reply({ embeds: [success(`\`${id}\` is already unlocked ${what}${res.record.activatedBy ? ` by \`${res.record.activatedBy}\`` : ''}.`)] });
    }
    const what = local
      ? 'LOCAL ONLY — `v lb`, `v glb` and `v slb` here show only this server\'s members (offline/isolated).'
      : 'Members there can use the bot globally now.';
    return message.reply({ embeds: [success(
      `Unlocked \`${id}\`${res.record.guildName ? ` (${res.record.guildName})` : ''}. ${what}`,
    )] });
  },
};
