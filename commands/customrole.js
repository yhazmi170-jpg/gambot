const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'customrole',
  aliases: ['cr'],
  description: 'set your custom role name and color (requires Custom Role perk)',
  execute(message, args) {
    if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });

    if (!db.hasPerk(message.author.id, 'custom_role')) {
      return message.channel.send({ embeds: [error("you don't own the **Custom Role** perk — buy it from `v shop`")] });
    }

    if (!args.length) return message.channel.send({ embeds: [error('usage: `v customrole name | #color`\nexample: `v customrole My Cool Role | #ff0000`')] });

    const parts = args.join(' ').split('|').map(s => s.trim());
    const roleName = parts[0];
    if (!roleName) return message.channel.send({ embeds: [error('provide a role name')] });

    const color = parts[1] ? parseInt(parts[1].replace('#', ''), 16) : 0x2b2d31;
    if (isNaN(color) || color > 0xffffff) return message.channel.send({ embeds: [error('invalid color — use hex like `#ff0000`')] });

    const existingRoleId = db.getCustomRole(message.author.id, message.guild.id);

    message.guild.members.fetch(message.author.id).then(member => {
      if (existingRoleId) {
        const role = message.guild.roles.cache.get(existingRoleId);
        if (role) {
          role.setName(roleName).then(() =>
            role.setColor(color).then(() => {
              message.channel.send({ embeds: [success(`updated your custom role to **${roleName}** (\`#${color.toString(16).padStart(6, '0')}\`)`)] });
            }).catch(() => message.channel.send({ embeds: [error("can't set color — check bot permissions")] }))
          ).catch(() => message.channel.send({ embeds: [error("can't rename role — check bot permissions")] }));
          return;
        }
      }

      message.guild.roles.create({
        name: roleName,
        color,
        reason: `custom role for ${message.author.tag}`,
      }).then(role => {
        member.roles.add(role).catch(() => {});
        db.setCustomRole(message.author.id, message.guild.id, role.id);
        message.channel.send({ embeds: [success(`created custom role **${roleName}** for you!`)] });
      }).catch(() => {
        message.channel.send({ embeds: [error("can't create role — bot needs **Manage Roles** permission")] });
      });
    }).catch(() => {
      message.channel.send({ embeds: [error("can't find you in this server")] });
    });
  },
};
