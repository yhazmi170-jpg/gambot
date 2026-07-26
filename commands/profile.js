const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'profile',
  helpCategory: 'Social',
  helpArgs: '[@user]',
  description: 'detailed stats card (requires profile perk)',
  aliases: ['stats', 'me'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'profile') && message.author.id !== config.ownerId) {
      return message.channel.send({ embeds: [error('you need the **profile** perk — buy it in `v shop`')] });
    }

    const target = message.mentions.users.first() || message.author;
    const user = db.ensureUser(target.id);
    if (!user) return message.channel.send({ embeds: [error('user not found')] });

    const marriage = db.getMarriage(target.id);
    const children = db.getChildren(target.id);
    const parents = db.getParents(target.id);
    const perks = db.getUserPerks(target.id);
    const now = Math.floor(Date.now() / 1000);
    const badge = db.hasPerk(target.id, 'badge') ? db.getBadgeEmoji(target.id) + ' ' : '';

    const fields = [
      ['Balance', `**${user.balance.toLocaleString()}** ${config.currency}`],
      ['Total Gambled', `**${user.total_gambled.toLocaleString()}** ${config.currency}`],
      ['Total Won', `**${user.total_won.toLocaleString()}** ${config.currency}`],
      ['Reputation', `**${user.reputation}** rep`],
    ];

    if (marriage) {
      const partnerId = marriage.user_id === target.id ? marriage.partner_id : marriage.user_id;
      fields.push(['Married to', `<@${partnerId}>`]);
    }
    if (children.length) {
      fields.push(['Children', children.map(c => `<@${c}>`).join(', ')]);
    }
    if (parents.length) {
      fields.push(['Parents', parents.map(p => `<@${p}>`).join(', ')]);
    }
    if (perks.length) {
      const lines = perks.map(p => {
        if (p.expires_at > 0) {
          const left = Math.max(0, p.expires_at - now);
          const d = Math.floor(left / 86400);
          return `${p.perk} (${d}d left)`;
        }
        return p.perk;
      });
      fields.push(['Perks', lines.join(', ')]);
    }

    message.channel.send({
      embeds: [embed(`${badge}📊 ${target.username}'s Profile`, fields, 0x2b2d31)],
    });
  },
};
