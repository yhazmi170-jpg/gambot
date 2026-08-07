const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');

const BOUNTY_LABELS = {
  hunt: 'hunt animals',
  sacrifice: 'sacrifice animals',
  win: 'win coins from games',
  work: 'work shifts',
  give: 'give coins to other players',
  battle: 'win battles',
};

module.exports = {
  name: 'bounty',
  helpCategory: 'Economy',
  helpArgs: '[create @player <goal> <prize> | list | info <id> | cancel <id>]',
  description: 'weekly bounty, or player-funded PvP bounty (first to N duel wins takes the pot)',
  aliases: ['bnt'],
  execute(message, args) {
    const userId = message.author.id;
    const cmd = (args[0] || '').toLowerCase();

    if (cmd === 'create') {
      const target = message.mentions.users.first();
      const goal = parseInt(args[2], 10);
      const prize = parseAmount(args[3]);
      if (!target || target.id === userId || target.bot) return message.channel.send({ embeds: [error('mention someone (not yourself) to bounty')] });
      if (isNaN(goal) || goal < 1 || goal > 10) return message.channel.send({ embeds: [error('goal must be 1–10 duel wins — usage: `v bounty create @user <goal> <amount>`')] });
      if (isNaN(prize) || prize <= 0) return message.channel.send({ embeds: [error('enter a valid prize — usage: `v bounty create @user <goal> <amount>`')] });
      const res = db.createPvpBounty(userId, target.id, goal, prize);
      if (!res.ok) {
        if (res.reason === 'coins') return message.channel.send({ embeds: [error(`you need **${prize.toLocaleString()}** ${config.currency} to fund this bounty`)] });
        return message.channel.send({ embeds: [error('you already have an active bounty with that player')] });
      }
      return message.channel.send({ embeds: [embed('🏴 Bounty Posted', [
        ['Prize', `**${prize.toLocaleString()}** ${config.currency}`],
        ['Target', `<@${target.id}>`],
        ['Goal', `first to **${goal}** duel wins against the other takes the pot`],
        ['', 'duel them with `v duel @user <amount>` — wins count toward the bounty'],
      ], 0xfee75c)] });
    }

    if (cmd === 'list' || cmd === 'board') {
      const list = db.listActiveBounties();
      if (!list.length) return message.channel.send({ embeds: [error('no active bounties right now — fund one with `v bounty create @user <goal> <amount>`')] });
      const lines = list.map(b => `\`#${b.id}\` <@${b.poster_id}> vs <@${b.target_id}> — **${b.prize.toLocaleString()}** ${config.currency} · ${b.goal} wins (${b.poster_wins}/${b.target_wins})`);
      return message.channel.send({ embeds: [embed('🏴 Bounty Board', [['Active', lines.join('\n')]])] });
    }

    if (cmd === 'info') {
      const id = parseInt(args[1], 10);
      const b = db.getPvpBounty(id);
      if (!b) return message.channel.send({ embeds: [error('bounty not found')] });
      const status = b.status === 'done' ? `done — winner <@${b.winner_id}>` : b.status === 'expired' ? 'expired (prize refunded)' : b.status === 'cancelled' ? 'cancelled' : 'active';
      return message.channel.send({ embeds: [embed(`🏅 Bounty #${b.id}`, [
        ['Poster', `<@${b.poster_id}>`],
        ['Target', `<@${b.target_id}>`],
        ['Prize', `**${b.prize.toLocaleString()}** ${config.currency}`],
        ['Score', `<@${b.poster_id}> ${b.poster_wins} — ${b.target_wins} <@${b.target_id}> (first to **${b.goal}**)`],
        ['Status', status],
      ])] });
    }

    if (cmd === 'cancel') {
      const id = parseInt(args[1], 10);
      const res = db.cancelPvpBounty(userId, id);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'notowner' ? 'only the poster can cancel' : res.reason === 'started' ? 'bounty already has duels fought — can\'t cancel' : 'bounty not found')] });
      return message.channel.send({ embeds: [success(`bounty #${id} cancelled — your prize was **refunded**`)] });
    }

    if (cmd === 'claim') {
      const b = db.claimBounty(userId);
      if (!b) {
        const cur = db.getBounty(userId);
        return message.channel.send({ embeds: [error(cur.claimed ? 'you already claimed this week\'s bounty!' : `bounty not done yet — **${cur.progress}/${cur.target}** ${BOUNTY_LABELS[cur.key]}`)] });
      }
      return message.channel.send({ embeds: [success(`bounty complete! claimed **${b.reward.toLocaleString()}** ${config.currency} 💰`) ] });
    }

    const pvp = db.listActiveBounties().find(x => x.poster_id === userId || x.target_id === userId);
    const b = db.getBounty(userId);
    const pct = Math.min(100, Math.floor((b.progress / b.target) * 100));
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    const extra = pvp ? `\n\n🏅 You have a **PvP bounty** — \`v bounty info ${pvp.id}\`` : '';
    return message.channel.send({ embeds: [embed('🎯 Weekly Bounty', [
      ['Task', `**${b.progress.toLocaleString()}/${b.target.toLocaleString()}** ${BOUNTY_LABELS[b.key]}`],
      ['Progress', `${bar} **${pct}%**`],
      ['Reward', `**${b.reward.toLocaleString()}** ${config.currency}`],
      ['', (b.claimed ? 'claimed for this week — resets next week!' : '`v bounty claim` when done') + extra],
    ], 0xf1c40f)] });
  },
};