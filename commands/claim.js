const db = require('../db');
const { error, success } = require('../utils/embed');
const config = require('../config');
const { SOURCE_EMOJI } = require('./inbox');

function formatDelivery(d) {
  const emoji = SOURCE_EMOJI[d.source] || '📦';
  const sender = d.sender_id && d.sender_id !== '__system__' ? `<@${d.sender_id}>` : 'gambot';
  const who = d.sender_id && d.sender_id !== '__system__' ? ` from ${sender}` : '';
  const coinPart = d.amount > 0 ? `${d.amount.toLocaleString()} ${config.currency}` : '';
  const label = d.label ? (' — ' + d.label) : '';
  return `${emoji} #${d.id}${coinPart ? ' `' + coinPart + '`' : ''}${who}${label} (${d.status})`;
}

module.exports = {
  name: 'claim',
  helpCategory: 'Economy',
  helpArgs: '[id|all]',
  description: 'claim ur inbox — payouts, gifts and rewards (v claim all / v claim <id>)',
  aliases: ['in'],
  async execute(message, args) {
    const arg = (args[0] || '').toLowerCase();

    if (arg && arg !== 'all' && !isNaN(Number(arg))) {
      const id = Math.floor(Number(arg));
      const res = db.safeClaim(id, message.author.id);
      if (!res.ok) {
        const reason = res.reason === 'already' ? 'that delivery was already claimed' : res.reason === 'not-yours' ? "that aint yours" : 'no delivery with that id';
        return message.channel.send({ embeds: [error(reason)] });
      }
      db.recordActivity(message.author.id, 'claim');
      const d = res.delivery;
      const parts = [];
      if (d.amount > 0) parts.push(`**${d.amount.toLocaleString()}** ${config.currency}`);
      return message.channel.send({ embeds: [success(`claimed #${d.id} — ${parts.join(', ') || 'the gift'} moved into ur account`)] });
    }

    const res = db.claimAllDeliveries(message.author.id);
    db.recordActivity(message.author.id, 'claim');
    if (!res.count) {
      return message.channel.send({ embeds: [error('ur inbox is empty — nothing to claim')] });
    }
    const credited = res.credited > 0 ? `**${res.credited.toLocaleString()}** ${config.currency}` : 'some goodies';
    return message.channel.send({ embeds: [success(`claimed ${res.count} delivery(ies) — ${credited} moved into ur account`)] });
  },
};