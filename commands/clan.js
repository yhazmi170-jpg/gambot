const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'clan',
  helpCategory: 'Social',
  helpArgs: '<create <name> | join [@user|name] | leave | kick @user | deposit <amt> | withdraw <amt> | info | delete | top>',
  description: 'player-owned clans — one clan per player, join anyone\u2019s clan across the server',
  aliases: ['guild'],
  execute(message, args) {
    const userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    const usage = 'usage: `v clan create <name>` | `v clan join @user` | `v clan info` | `v clan deposit <amt>` | `v clan top`';
    if (!sub) return message.channel.send({ embeds: [error(usage)] });

    if (sub === 'create') {
      const name = args.slice(1).join(' ').trim();
      if (!name) return message.channel.send({ embeds: [error('give a clan name: `v clan create Family`')] });
      const res = db.createClan(userId, name);
      if (!res.ok) {
        const reasons = { created: 'you already own a clan — a player can only own one', member: 'you are already in a clan — leave it first with `v clan leave`', coins: `creating a clan costs **${db.CLAN_CREATE_COST.toLocaleString()}** coins` };
        return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not create clan')] });
      }
      return message.channel.send({ embeds: [embed('🏰 Clan Created', [['Name', res.name], ['Owner', `<@${userId}>`], ['Next', 'friends can `v clan join <@you>`; `v clan deposit <amt>` fills the treasury']])] });
    }

    const myClanId = db.getClanOf(userId);
    const clan = myClanId ? db.getClan(myClanId) : null;

    if (sub === 'join') {
      const target = message.mentions.users.first();
      const nameArg = args.slice(1).join(' ').trim();
      let clanId = target ? (db.getClanOf(target.id) || (db.getClan(target.id) ? target.id : null)) : (nameArg ? db.findClanByName(nameArg) : null);
      if (!clanId) return message.channel.send({ embeds: [error('no clan found — mention a member or give a clan name: `v clan join <name>`')] });
      const res = db.clanJoin(clanId, userId);
      if (!res.ok) {
        const reasons = { noclan: 'that clan no longer exists', member: 'you are already in a clan — leave it first with `v clan leave`', full: 'that clan is full' };
        return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not join clan')] });
      }
      const targetClan = db.getClan(clanId);
      return message.channel.send({ embeds: [success(`joined **${targetClan.name}** (owned by <@${targetClan.owner_id}>)!`)] });
    }

    if (sub === 'leave') {
      if (clan && clan.owner_id === userId) return message.channel.send({ embeds: [error('the owner cannot leave — dissolve the clan with `v clan delete`')] });
      const res = clan ? db.clanLeave(clan.clan_id, userId) : { ok: false, reason: 'noclan' };
      if (!res.ok) return message.channel.send({ embeds: [error('you are not in a clan')] });
      return message.channel.send({ embeds: [success('you left the clan')] });
    }

    if (sub === 'delete') {
      if (!clan) return message.channel.send({ embeds: [error('you are not in a clan')] });
      const res = db.deleteClan(clan.clan_id, userId);
      if (!res.ok) return message.channel.send({ embeds: [error('only the clan owner can delete the clan')] });
      return message.channel.send({ embeds: [success(`**${clan.name}** disbanded${res.refund ? ` — you got back **${res.refund.toLocaleString()}** ${config.currency} (half the treasury)` : ''}`)] });
    }

    if (sub === 'kick') {
      const target = message.mentions.users.first();
      if (!target) return message.channel.send({ embeds: [error('mention someone to kick: `v clan kick @user`')] });
      if (!clan) return message.channel.send({ embeds: [error('you are not in a clan')] });
      const res = db.clanKick(clan.clan_id, userId, target.id);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'owner' ? 'only the clan owner can kick' : 'that member is not in your clan')] });
      return message.channel.send({ embeds: [success(`kicked **${target.username}** from **${clan.name}**`)] });
    }

    if (sub === 'deposit') {
      const amt = parseInt(args[1], 10);
      if (!amt || amt <= 0) return message.channel.send({ embeds: [error('usage: `v clan deposit <amount>`')] });
      if (!clan) return message.channel.send({ embeds: [error('you are not in a clan yet — join one with `v clan join <@user>`')] });
      const res = db.clanDeposit(clan.clan_id, userId, amt);
      if (!res.ok) return message.channel.send({ embeds: [error('not enough coins')] });
      return message.channel.send({ embeds: [success(`deposited **${amt.toLocaleString()}** into **${clan.name}**'s treasury`)] });
    }

    if (sub === 'withdraw') {
      const amt = parseAmount(args[1]);
      if (!amt || amt <= 0) return message.channel.send({ embeds: [error('usage: `v clan withdraw <amount>` (owner only)')] });
      if (!clan) return message.channel.send({ embeds: [error('you are not in a clan')] });
      const res = db.clanWithdraw(clan.clan_id, userId, amt);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'owner' ? 'only the clan owner can withdraw' : 'clan treasury is too low')] });
      return message.channel.send({ embeds: [success(`withdrew **${amt.toLocaleString()}** from **${clan.name}**'s treasury (now **${(clan.balance - amt).toLocaleString()}** left)`)] });
    }

    if (sub === 'top') {
      const top = db.getClanTop(10);
      if (!top.length) return message.channel.send({ embeds: [error('no clans yet — `v clan create <name>`')] });
      const lines = top.map((c, i) => `**${i + 1}.** ${c.name} — **${c.balance.toLocaleString()}** ${config.currency}`).join('\n');
      return message.channel.send({ embeds: [embed('Clan Leaderboard', [['Top Clans', lines]])] });
    }

    if (sub === 'info') {
      if (!clan) return message.channel.send({ embeds: [error('you are not in a clan — create one with `v clan create <name>` or join a friend\u2019s: `v clan join @user`')] });
      const members = db.getClanMembers(clan.clan_id);
      const shown = members.slice(0, 15).map(id => `<@${id}>`).join(' ');
      return message.channel.send({ embeds: [embed(`🏰 ${clan.name}`, [
        ['Owner', `<@${clan.owner_id}>`],
        ['Members', `${members.length} total\n${shown}${members.length > 15 ? `\n…and ${members.length - 15} more` : ''}`],
        ['Treasury', `**${clan.balance.toLocaleString()}** ${config.currency}`],
        ['Commands', '`v clan deposit <amt>` · `v clan join @user` · `v clan top`'],
      ])] });
    }

    return message.channel.send({ embeds: [error(usage)] });
  },
};