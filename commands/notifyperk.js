const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'notifyperk',
  aliases: ['np'],
  description: 'DM all holders of a perk (owner only)',
  execute(message, args) {
    if (message.author.id !== config.ownerId) return;

    if (!args.length) return message.channel.send({ embeds: [error('usage: `Anotifyperk <perk_name> | <message>`')] });

    const parts = args.join(' ').split('|').map(s => s.trim());
    const perk = parts[0];
    const msg = parts[1];
    if (!perk || !msg) return message.channel.send({ embeds: [error('provide perk name and message separated by `|`')] });

    const holders = db.getPerkHolders(perk);
    if (!holders.length) return message.channel.send({ embeds: [error(`no one owns the **${perk}** perk`) ] });

    message.channel.send({ embeds: [success(`DMing **${holders.length}** user(s) who own **${perk}**...`)] });

    let sent = 0;
    for (const uid of holders) {
      message.client.users.fetch(uid).then(user => {
        user.send(`**📢 Perk Update — ${perk}**\n\n${msg}`).then(() => sent++).catch(() => {});
      }).catch(() => {});
    }

    setTimeout(() => {
      message.channel.send({ embeds: [success(`Notified **${sent}**/${holders.length} user(s)`)] });
    }, 3000);
  },
};
