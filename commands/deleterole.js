const db = require('../db');
const { error, success } = require('../utils/embed');

module.exports = {
  name: 'deleterole',
  helpCategory: 'Shop',
  helpArgs: '',
  aliases: ['delrole', 'removerole'],
  description: 'delete your custom role (requires Custom Role perk)',
  execute(message, args) {
    if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });

    if (!db.hasPerk(message.author.id, 'custom_role')) {
      return message.channel.send({ embeds: [error("you don't own the **Custom Role** perk")] });
    }

    const roleId = db.getCustomRole(message.author.id, message.guild.id);
    if (!roleId) return message.channel.send({ embeds: [error("you don't have a custom role in this server")] });

    const role = message.guild.roles.cache.get(roleId);
    if (role) {
      role.delete('custom role deleted by user').then(() => {
        db.deleteCustomRole(message.author.id, message.guild.id);
        message.channel.send({ embeds: [success('deleted your custom role')] });
      }).catch(() => {
        message.channel.send({ embeds: [error("can't delete role — check bot permissions")] });
      });
    } else {
      db.deleteCustomRole(message.author.id, message.guild.id);
      message.channel.send({ embeds: [success('cleared your custom role (was already deleted)')] });
    }
  },
};
