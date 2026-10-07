const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

// unclaimed `v inbox` money the player has been gifted but not collected yet
function inboxSummary(userId) {
  try {
    const pending = db.getPendingDeliveries(userId, 50);
    return { total: pending.reduce((sum, d) => sum + (Number(d.amount) || 0), 0), count: pending.length };
  } catch (e) {
    return { total: 0, count: 0 };
  }
}

module.exports = {
  name: 'bal',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'check your balance',
  aliases: ['balance', 'wallet', 'cash'],
  execute(message, args) {
    const mentioned = message.mentions.users.first();
    if (mentioned && mentioned.bot) {
      return message.channel.send({ embeds: [error('bots have no balance')] });
    }
    // `v bal @user` is an owner-only audit view (owner decision 2026-10-07) —
    // members can only ever look at their own money.
    const viewingOther = !!(mentioned && mentioned.id !== message.author.id);
    if (viewingOther && !config.isOwner(message.author.id)) {
      return message.channel.send({ embeds: [error('you can only check your own balance — `v bal`')] });
    }

    const target = mentioned || message.author;
    const user = db.ensureUser(target.id);
    if (!user) return message.channel.send({ embeds: [error('user not found')] });

    const inbox = inboxSummary(target.id);
    const moneyLabel = config.currency.charAt(0).toUpperCase() + config.currency.slice(1);
    const fields = [
      ['User', `<@${target.id}>`],
      [moneyLabel, `**${user.balance.toLocaleString()}**`],
      ['Bank', `**${user.bank.toLocaleString()}**`],
      ['Inbox (unclaimed)', `**${inbox.total.toLocaleString()}**${inbox.count ? ` · ${inbox.count} pending` : ''}`],
      ['Gems', `${user.gems} 💎`],
    ];
    if (viewingOther && user.loan > 0) fields.push(['Loan', `**${user.loan.toLocaleString()}**`]);
    fields.push(
      ['Total Gambled', user.total_gambled ? user.total_gambled.toLocaleString() : '0'],
      ['Total Won', user.total_won ? user.total_won.toLocaleString() : '0'],
    );
    return message.channel.send({ embeds: [embed('💰 Balance', fields)] });
  },
};
