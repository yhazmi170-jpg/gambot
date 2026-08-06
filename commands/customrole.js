const db = require('../db');
const { embed, error, success } = require('../utils/embed');

const DEFAULT_COLOR = 0x2b2d31;

function parseColor(str) {
  if (!str) return null;
  const clean = String(str).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const c = parseInt(clean, 16);
  return isNaN(c) || c > 0xffffff ? null : c;
}

module.exports = {
  name: 'customrole',
  helpCategory: 'Shop',
  helpArgs: '[name <name> | color <#hex> | name | #color]',
  aliases: ['cr'],
  description: 'set your custom role name and/or color (requires Custom Role perk)',
  execute(message, args) {
    if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
    if (!db.hasPerk(message.author.id, 'custom_role')) {
      return message.channel.send({ embeds: [error("you don't own the **Custom Role** perk — buy it from `v shop`")] });
    }

    const input = args.join(' ').trim();
    if (!input) {
      return message.channel.send({ embeds: [error('usage:\n`v customrole name <name>` — change the name\n`v customrole color #hex` — change the color\n`v customrole name | #hex` — change both')] });
    }

    const sub = (args[0] || '').toLowerCase();
    let roleName = null;
    let color = null;

    if (sub === 'name') {
      roleName = args.slice(1).join(' ').trim();
      if (!roleName) return message.channel.send({ embeds: [error('provide a name — `v customrole name My Role`')] });
    } else if (sub === 'color' || sub === 'colour') {
      color = parseColor(args[1]);
      if (color === null) return message.channel.send({ embeds: [error('invalid color — use hex like `#ff0000`')] });
    } else {
      const parts = input.split('|').map(s => s.trim());
      roleName = parts[0] || null;
      color = parseColor(parts[1]);
      if (parts[1] !== undefined && color === null) return message.channel.send({ embeds: [error('invalid color — use hex like `#ff0000`')] });
      if (!roleName && color === null) return message.channel.send({ embeds: [error('provide a name and/or color — `v customrole My Role | #ff0000`')] });
    }

    const botHighest = message.guild.members.me.roles.highest;

    message.guild.members.fetch(message.author.id).then(async member => {
      const existingRoleId = db.getCustomRole(message.author.id, message.guild.id);
      let role = existingRoleId ? message.guild.roles.cache.get(existingRoleId) : null;
      if (!role && existingRoleId) {
        try { role = await message.guild.roles.fetch(existingRoleId); } catch (e) { role = null; }
      }

      if (role) {
        const updates = [];
        if (roleName) updates.push(role.setName(roleName));
        if (color !== null) updates.push(role.setColor(color));
        try {
          await Promise.all(updates);
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role).catch(() => {});
          }
          return message.channel.send({ embeds: [success(`updated your custom role to **${role.name}**${color !== null ? ` (\`#${color.toString(16).padStart(6, '0')}\`)` : ''}`)] });
        } catch (e) {
          return message.channel.send({ embeds: [error(`can't update the role — the bot needs **Manage Roles**, and its highest role must be above yours (it is${botHighest ? ` **${botHighest.name}**` : ''})`)] });
        }
      }

      try {
        const newRole = await message.guild.roles.create({
          name: roleName || `${message.author.username}'s Role`,
          color: color !== null ? color : DEFAULT_COLOR,
          reason: `custom role for ${message.author.tag}`,
        });
        await newRole.setPosition(Math.max(0, botHighest.position - 1));
        await member.roles.add(newRole);
        db.setCustomRole(message.author.id, message.guild.id, newRole.id);
        return message.channel.send({ embeds: [success(`created custom role **${newRole.name}** for you!`)] });
      } catch (e) {
        return message.channel.send({ embeds: [error("can't create the role — the bot needs **Manage Roles** permission")] });
      }
    }).catch(() => {
      message.channel.send({ embeds: [error("can't find you in this server")] });
    });
  },
};
