const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'clan',
  helpCategory: 'Social',
  helpArgs: '<create <name> | join | leave | kick @user | deposit <amt> | withdraw <amt> | info | top>',
  description: 'guild-wide clans with a shared treasury',
  aliases: ['guild'],
  execute(message, args) {
    const userId = message.author.id;
    const guildId = message.guild ? message.guild.id : 'global';
    const sub = (args[0] || '').toLowerCase();
    if (!sub) return message.channel.send({ embeds: [error('usage: `v clan create <name>` | `v clan join` | `v clan leave` | `v clan info` | `v clan deposit <amt>` | `v clan top`')] });

    if (sub === 'create') {
      const name = args.slice(1).join(' ').trim();
      if (!name) return message.channel.send({ embeds: [error('give a clan name: `v clan create Family`')] });
      const res = db.createClan(guildId, userId, name);
      if (!res.ok) {
        const reasons = { exists: 'this server already has a clan', coins: `creating a clan costs **${db.CLAN_CREATE_COST.toLocaleString()}** coins` };
        return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not create clan')] });
      }
      return message.channel.send({ embeds: [embed('Clan Created', [['Name', res.name], ['Owner', `<@${userId}>`], ['Next', 'members can `v clan join`; `v clan deposit <amt>` fills the treasury']])] });
    }

    const clan = db.getClan(guildId);
    if (sub === 'join') {
      const res = db.clanJoin(guildId, userId);
      if (!res.ok) return message.channel.send({ embeds: [error({ noclan: 'no clan in this server yet — create one with `v clan create <name>`', member: 'you are already in this clans clan', full: 'clan is full' }[res.reason] || 'could not join')] });
      return message.channel.send({ embeds: [successEmbed(`joined **${clan.name}**`)] });
    }

    if (sub === 'leave') {
      const res = db.clanLeave(guildId, userId);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'owner' ? 'the owner cannot leave — transfer by deleting the clan, or kick yourself? try `v clan revoke`' : 'you are not in a clan')] });
      return message.channel.send({ embeds: [successEmbed('you left the clan')] });
    }

    if (sub === 'kick') {
      const target = message.mentions.users.first();
      if (!target) return message.channel.send({ embeds: [error('mention someone to kick: `v clan kick @user`')] });
      const res = db.clanKick(guildId, userId, target.id);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'owner' ? 'only the clan owner can kick' : 'no clan or member')] });
      return message.channel.send({ embeds: [successEmbed(`kicked **${target.username}** from the clan`)] });
    }

    if (sub === 'deposit') {
      const amt = parseInt(args[1], 10);
      if (!amt || amt <= 0) return message.channel.send({ embeds: [error('usage: `v clan deposit <amount>`')] });
      const res = db.clanDeposit(guildId, userId, amt);
      if (!res.ok) return message.channel.send({ embeds: [error('no clan here, or not enough coins')] });
      return message.channel.send({ embeds: [successEmbed(`deposited **${amt.toLocaleString()}** into the clan treasury`)] });
    }

    if (sub === 'withdraw') {
      const amt = parseAmount(args[1]);
      if (!amt || amt <= 0) return message.channel.send({ embeds: [error('usage: `v clan withdraw <amount>` (owner only)')] });
      const res = db.clanWithdraw(guildId, userId, amt);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'owner' ? 'only the clan owner can withdraw' : 'clan treasury is too low')] });
      return message.channel.send({ embeds: [successEmbed(`withdrew **${amt.toLocaleString()}** from the treasury`)] });
    }

    if (sub === 'top') {
      const top = db.getClanTop(10);
      if (!top.length) return message.channel.send({ embeds: [error('no clans yet — `v clan create <name>`')] });
      const lines = top.map((c, i) => `**${i + 1}.** ${c.name} — **${c.balance.toLocaleString()}** ${config.currency}`).join('\n');
      return message.channel.send({ embeds: [embed('Clan Leaderboard', [['Top Clans', lines]])] });
    }

    if (sub === 'info') {
      const clan = db.getClan(guildId);
      if (!clan) return message.channel.send({ embeds: [error('no clan here — `v clan create <name>`')] });
      const members = db.getClanMembers(guildId);
      const shown = members.slice(0, 15).map(id => `<@${id}>`).join(' ');
      return message.channel.send({ embeds: [embed(`🏰 ${clan.name}`, [
        ['Owner', `<@${clan.owner_id}>`],
        ['Members', `${members.length} total\n${shown}${members.length > 15 ? `\n…and ${members.length - 15} more` : ''}`],
        ['Treasury', `**${clan.balance.toLocaleString()}** ${config.currency}`],
        ['Commands', '`v clan deposit <amt>` · `v clan top` · `v clan join`'],
      ])] });
    }

    return message.channel.send({ embeds: [error('usage: `v clan create <name>` | `v clan join` | `v clan leave` | `v clan info` | `v clan deposit <amt>` | `v clan top`')] });
  },
};

function successEmbed(msg) {
  return require('../utils/embed').success(msg);
}