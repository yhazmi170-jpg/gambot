const db = require('../db');
const { embed, error, success } = require('../utils/embed');

const DEFAULT_COLOR = 0x2b2d31;
// custom roles are always stacked directly below this role
const ANCHOR_ROLE_ID = '1535224349965942884';

function parseColor(str) {
  if (!str) return null;
  const clean = String(str).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const c = parseInt(clean, 16);
  return isNaN(c) || c > 0xffffff ? null : c;
}

async function positionToAnchor(guild, role) {
  try {
    const [anchor, fresh, botHigh] = await Promise.all([
      guild.roles.fetch(ANCHOR_ROLE_ID).catch(() => null),
      guild.roles.fetch(role.id),
      guild.members.me.roles.highest?.fetch?.() ?? Promise.resolve(guild.members.me.roles.highest ?? null),
    ]);
    const target = anchor ? anchor.position - 1 : null;
    const botCap = botHigh ? botHigh.position - 1 : (fresh.position - 1);
    const goal = target !== null ? Math.min(target, botCap) : botCap;
    if (goal < 1) {
      console.warn(`[customrole] skipping position — no slot under anchor (anchor=${anchor?.position ?? 'missing'}, botHigh=${botHigh?.position ?? 'none'})`);
      return;
    }
    if (fresh.position === goal) return;
    await fresh.setPosition(goal, { reason: 'custom role under anchor' });
    if (fresh.position !== goal) {
      console.error(`[customrole] move to ${goal} failed silently — role at ${fresh.position}`);
    }
  } catch (e) {
    console.error('[customrole] positionToAnchor error:', e.message);
  }
}

module.exports = {
  name: 'customrole',
  helpCategory: 'Shop',
  helpArgs: '[name <name> | color <#hex [#hex]> | delete | name | #color]',
  aliases: ['cr'],
  description: 'set your custom role name/color (2 colors = gradient) — requires Custom Role perk',
  execute(message, args) {
    if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
    if (!db.hasPerk(message.author.id, 'custom_role')) {
      return message.channel.send({ embeds: [error("you don't own the **Custom Role** perk — buy it from `v shop`")] });
    }

    const input = args.join(' ').trim();
    if (!input) {
      return message.channel.send({ embeds: [error('usage:\n`v customrole name <name>` — change the name\n`v customrole color <#hex>` — change the color\n`v customrole color <#hex1> <#hex2>` — animated gradient between the two\n`v customrole delete` — delete your role\n`v customrole name | #hex` — change both')] });
    }

    const sub = (args[0] || '').toLowerCase();

    if (sub === 'delete' || sub === 'del' || sub === 'remove' || sub === 'rm') {
      const roleId = db.getCustomRole(message.author.id, message.guild.id);
      if (!roleId) return message.channel.send({ embeds: [error("you don't have a custom role in this server")] });
      const role = message.guild.roles.cache.get(roleId) || message.guild.roles.cache.get(`${roleId}`);
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
      return;
    }

    let roleName = null;
    let color = null;
    let colorB = null;

    if (sub === 'name') {
      roleName = args.slice(1).join(' ').trim();
      if (!roleName) return message.channel.send({ embeds: [error('provide a name — `v customrole name My Role`')] });
    } else if (sub === 'color' || sub === 'colour') {
      color = parseColor(args[1]);
      if (color === null) return message.channel.send({ embeds: [error('invalid color — use hex like `#ff0000`')] });
      if (args[2] !== undefined) {
        colorB = parseColor(args[2]);
        if (colorB === null) return message.channel.send({ embeds: [error('invalid 2nd color — use hex like `#00ff00`')] });
      }
    } else {
      const parts = input.split('|').map(s => s.trim());
      roleName = parts[0] || null;
      color = parseColor(parts[1]);
      if (parts[1] !== undefined && color === null) return message.channel.send({ embeds: [error('invalid color — use hex like `#ff0000`')] });
      if (parts[2] !== undefined) {
        colorB = parseColor(parts[2]);
        if (colorB === null) return message.channel.send({ embeds: [error('invalid 2nd color — use hex like `#00ff00`')] });
      }
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
          await positionToAnchor(message.guild, role);
          if (colorB !== null) {
            db.setCustomRoleColor(message.author.id, message.guild.id, color, colorB);
            return message.channel.send({ embeds: [success(`gradient set — **${role.name}** fades between \`#${color.toString(16).padStart(6, '0')}\` and \`#${colorB.toString(16).padStart(6, '0')}\`. give it a few seconds to animate.`)] });
          }
          db.setCustomRoleColor(message.author.id, message.guild.id, color, null);
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
        await positionToAnchor(message.guild, newRole);
        await member.roles.add(newRole);
        db.setCustomRole(message.author.id, message.guild.id, newRole.id);
        if (colorB !== null) {
          db.setCustomRoleColor(message.author.id, message.guild.id, color, colorB);
        }
        return message.channel.send({ embeds: [success(`created custom role **${newRole.name}** for you!`)] });
      } catch (e) {
        return message.channel.send({ embeds: [error("can't create the role — the bot needs **Manage Roles** permission")] });
      }
    }).catch(() => {
      message.channel.send({ embeds: [error("can't find you in this server")] });
    });
  },
};