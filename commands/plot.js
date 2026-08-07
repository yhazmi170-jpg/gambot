const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'plot',
  helpCategory: 'Pets',
  helpArgs: '<buy | upgrade | claim | info>',
  description: 'own land and let it earn coins every hour',
  aliases: ['land'],
  execute(message, args) {
    const userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    const plot = db.getPlot(userId);

    if (!sub || sub === 'info') {
      if (!plot) return message.channel.send({ embeds: [embed('🏞️ Plots', [
        ['Cost', `**${db.PLOT_BASE_PRICE.toLocaleString()}** ${config.currency} to buy`],
        ['Income', `**${db.PLOT_INCOME_PER_HOUR.toLocaleString()}**/hour per level`],
        ['Upgrade', `**${db.PLOT_UPGRADE_COST.toLocaleString()}** per level (max **${db.PLOT_MAX_LEVEL}**)`],
        ['', 'buy one with `v plot buy`, then claim every hour with `v plot claim`'],
      ])] });
      const hours = Math.max(0, Math.floor((Math.floor(Date.now() / 1000) - plot.last_claim) / 3600));
      const pending = Math.min(24, hours) * db.PLOT_INCOME_PER_HOUR * plot.level;
      return message.channel.send({ embeds: [embed('🏞️ Your Plot', [
        ['Level', `${plot.level}/${db.PLOT_MAX_LEVEL}`],
        ['Income', `${db.PLOT_INCOME_PER_HOUR * plot.level} ${config.currency}/hour`],
        ['Pending', `**${pending.toLocaleString()}** ${config.currency} ready to claim`],
        ['Commands', '\u0060v plot claim\u0060 · `v plot upgrade`'],
      ])] });
    }

    if (sub === 'buy') {
      const res = db.buyPlot(userId);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'owned' ? 'you already own a plot' : `a plot costs **${db.PLOT_BASE_PRICE.toLocaleString()}** coins`)] });
      return message.channel.send({ embeds: [embed('Plot bought', [['Plan', `level ${res.level} plot`], ['', 'claim every hour with `v plot claim`'], ['upgrade plot']])] });
    }

    if (sub === 'upgrade') {
      const res = db.upgradePlot(userId);
      if (!res.ok) return message.channel.send({ embeds: [error({ noplot: 'no plot', max: 'already max level', coins: 'not enough coins' }[res.reason] || 'could not upgrade')] });
      return message.channel.send({ embeds: [embed('Plot Upgraded', [['Level', res.level], ['Cost', `${(res.cost || 0).toLocaleString()} ${config.currency}`]])] });
    }

    if (sub === 'claim') {
      const res = db.claimPlot(userId);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'noplot' ? 'no plot — buy one with `v plot buy`' : `too soon — wait ${Math.ceil(res.wait / 60)} more min`)] });
      return message.channel.send({ embeds: [embed('Plot Claimed', [
        ['Income', `+**${res.income.toLocaleString()}** ${config.currency}`],
        ['Hours', res.hours],
      ], 0x57f287)] });
    }

    return message.channel.send({ embeds: [error('usage: `v plot buy | upgrade | claim | info`')] });
  },
};