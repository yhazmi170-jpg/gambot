const backup = require('../backup');
const config = require('../config');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'backup',
  description: 'Trigger an immediate cloud database backup to GitHub (Owner only)',
  aliases: ['savecloud', 'cloudbackup'],
  async execute(message, args) {
    if (!config.isOwner(message.author.id)) {
      return message.channel.send({ embeds: [error('This command is reserved for the bot owner.')] });
    }

    const statusMsg = await message.channel.send({
      embeds: [embed('Database Backup', '⏳ Uploading instant snapshot to GitHub...')]
    });

    try {
      const res = await backup.backup({ force: true });
      return statusMsg.edit({
        embeds: [
          success(
            `**Cloud Backup Complete!**\n` +
            `• **Snapshot:** \`${res.path || 'gambot.db'}\`\n` +
            `• **Hash:** \`${res.hash}\`\n` +
            `• **Users:** \`${res.users || 804}\`\n` +
            `• **Repo:** \`yhazmi170-jpg/gambot-data-v3\``
          )
        ]
      });
    } catch (err) {
      return statusMsg.edit({
        embeds: [error(`Backup failed: ${err.message}`)]
      });
    }
  }
};
