const db = require('../db');
const { embed, success, error } = require('../utils/embed');

module.exports = {
  name: 'garden',
  helpCategory: 'Pets',
  helpArgs: '[buy|sell] [count]',
  aliases: ['snails', 'snail'],
  description: 'your garden — snail breeding stats + snail garden progression',
  execute(message, args) {
    const userId = message.author.id;
    const action = (args[0] || '').toLowerCase();
    const count = args[1] ? parseInt(args[1], 10) : 1;

    if (action === 'buy') {
      const n = !isNaN(count) && count > 0 ? Math.min(count, db.SNAIL_DAILY_LIMIT) : 1;
      const r = db.buySnails(userId, n);
      if (!r.ok) {
        if (r.reason === 'limit') return message.channel.send({ embeds: [error(`daily buy limit is **${db.SNAIL_DAILY_LIMIT}** snails — you can buy **${r.remaining}** more today`)] });
        if (r.reason === 'capacity') return message.channel.send({ embeds: [error(`your garden is full (**${r.capacity}** snails max)`)] });
        if (r.reason === 'coins') return message.channel.send({ embeds: [error(`buying **${n}** snail(s) costs **${r.cost}** coins (you have **${r.balance}**)`)] });
        return message.channel.send({ embeds: [error('invalid amount')] });
      }
      return message.channel.send({ embeds: [success(`bought **${r.bought}** snail(s) for **${r.cost}** coins — you have **${db.getSnailInfo(userId).snails}**\nbuy **${r.remaining}** more today at **${db.SNAIL_PRICE}** coins each`)] });
    }

    if (action === 'sell') {
      const n = !isNaN(count) && count > 0 ? count : 1;
      const r = db.sellSnails(userId, n);
      if (!r.ok) return message.channel.send({ embeds: [error('you have no snails to sell')] });
      return message.channel.send({ embeds: [success(`sold **${r.sold}** snail(s) for **${r.coins}** coins — you have **${db.getSnailInfo(userId).snails}** left`)] });
    }

    if (action !== '') {
      return message.channel.send({ embeds: [error('usage: `v garden` · `v garden buy <count>` · `v garden sell <count>`')] });
    }

    const bred = db.breedSnails(userId);
    const info = db.getSnailInfo(userId);
    const g = db.getGardenProfile(userId);
    const runner = db.GARDEN_RUNNERS[g.runner] || db.GARDEN_RUNNERS.snail;

    const winRate = g.total_runs > 0 ? Math.round((g.won_runs / g.total_runs) * 100) : 0;
    const barLen = 14;
    const baseXp = db.gardenXpForLevel(g.level);
    const filled = Math.round((g.xp - baseXp) / Math.max(1, g.xpToNext - baseXp) * barLen);
    const bar = '🟩'.repeat(Math.max(0, Math.min(barLen, filled))) + '⬛'.repeat(Math.max(0, barLen - Math.min(barLen, filled)));
    const ownedUpgrades = Object.entries(g.unlocks)
      .filter(([k]) => db.GARDEN_UPGRADES[k])
      .map(([k, l]) => `${db.GARDEN_UPGRADES[k].emoji}${l}`)
      .join(' ');
    const upgradeLine = ownedUpgrades || 'none yet — `v gardenshop`';

    let nextIn = '—';
    if (info.snails < info.capacity && info.snails > 0) {
      const elapsed = Math.floor(Date.now() / 1000) - (info.lastTick || Math.floor(Date.now() / 1000));
      const until = db.SNAIL_BREED_SECONDS ? db.SNAIL_BREED_SECONDS - elapsed : 0;
      nextIn = until > 0 ? `**${Math.ceil(until / 3600)}h**` : 'now';
    }

    const fields = [
      ['Gardener', `${runner.emoji} **${runner.name}** — switch with \`v gardenpet\``],
      ['Garden level', `**${g.level}** · ${g.xp.toLocaleString()} xp\n${bar} \`${g.xpRemaining.toLocaleString()} to level ${g.level + 1}\``],
      ['Runs', `**${g.total_runs}** total · **${g.won_runs}** sold (${winRate}%)\nbest **${g.best_run}** rows · biggest sell **${g.biggest_cashout.toLocaleString()}** coins`],
      ['Won / Lost', `**${g.total_won.toLocaleString()}** / **${g.total_lost.toLocaleString()}** coins (staked **${g.total_staked.toLocaleString()}**)`],
      ['Safety net', `saved **${g.safety_catches}** failed row(s)`],
      ['Upgrades', upgradeLine],
      ['Daily garden xp', `${g.xpUsedToday.toLocaleString()} / ${db.GARDEN_XP_DAY_CAP}`],
      ['Snails', `**${info.snails}** / ${info.capacity} — breeding 1 baby per snail per 24h, next in: ${nextIn}`],
      ['Snail value', `**${info.snails * db.SNAIL_SELL_PRICE}** coins (${db.SNAIL_SELL_PRICE} each) — buy **${info.buyLimitToday}** more today at **${db.SNAIL_PRICE}** each`],
    ];
    if (bred.bred > 0) fields.unshift(['', `🐣 **${bred.bred}** baby snail(s) hatched!`]);

    message.channel.send({ embeds: [embed(`🌻 ${message.author.username}'s Garden`, fields, 0x2b2d31)] });
  },
};
