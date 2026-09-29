const db = require('../db');
const config = require('../config');
const { error, success } = require('../utils/embed');
const { parseGuildId } = require('../utils/serverAccess');

// v usp — the other half of `v psu`: turn a server back off. Use it when a server
// should not be running the bot (abuse, wrong server, spam invite), or to lock one
// ahead of time by id before the bot is even invited there.
//
//   v usp           lock this server
//   v usp <id>      lock that server, from any server (paste an id from list)
//
// Locked servers keep their data (balances, pets, everything) — members just get
// the "not unlocked yet" notice until you `v psu` it again. Owner only.
module.exports = {
  name: 'usp',
  aliases: ['lockserver', 'disableserver', 'relock', 'revokepsu'],
  helpCategory: 'Admin',
  description: 'Owner only: lock a server again (run with no id = this server)',
  helpArgs: '[server id]',

  async execute(message, args) {
    if (message.author.id !== config.ownerId) {
      return message.reply({ embeds: [error('This command is owner only.')] });
    }

    const arg = args && args[0] !== undefined ? String(args[0]) : '';

    if (!arg) {
      if (!message.guild) return message.reply({ embeds: [error('Run `v usp` inside a server, or `v usp <server id>` to pick one.')] });
      const here = db.getServerAccess(message.guild.id);
      if (here && here.status === 'locked') {
        return message.reply({ embeds: [success(`This server is already locked (by \`${here.activatedBy || 'owner'}\`).`)] });
      }
    }

    const id = parseGuildId(arg) || (message.guild ? message.guild.id : null);
    if (!id) return message.reply({ embeds: [error('That is not a server id. Copy one from `v psu list`.')] });

    const res = db.lockServer(id, message.author.id, message.guild ? message.guild.name : '');
    require('../utils/serverAccess').invalidateHiddenCache(); // a locked server stops hiding its members
    if (res.already) {
      return message.reply({ embeds: [success(`\`${id}\` is already locked. Members there can't use the bot.`)] });
    }
    const extra = res.wasActive ? ' Members there can\'t use the bot until you `v psu` it again.' : '';
    return message.reply({ embeds: [success(`Locked \`${id}\`.${extra}`)] });
  },
};
