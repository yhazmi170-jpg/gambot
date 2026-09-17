const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SOURCE_EMOJI = {
  give: '💸',
  contract: '📜',
  event: '🎉',
  achievement: '🏆',
  gift: '🎁',
  quest_bonus: '🗒️',
  title: '🎖️',
  giveaway: '🎉',
  system: '📦',
};

function formatDelivery(d) {
  const emoji = SOURCE_EMOJI[d.source] || '📦';
  const sender = d.sender_id && d.sender_id !== '__system__' ? `<@${d.sender_id}>` : 'gambot';
  const who = d.sender_id && d.sender_id !== '__system__' ? ` from ${sender}` : '';
  const coinPart = d.amount > 0 ? `**${d.amount.toLocaleString()}** ${config.currency}` : '';
  const label = d.label ? (', ' + d.label) : '';
  const when = `<t:${d.created_at}:R>`;
  return `${emoji} #${d.id}${coinPart ? ' `' + coinPart + '`' : ''}${who ? who : ''}${label} — ${when}`;
}

async function handleInteraction(i) {
  if (i.customId !== 'inbox_claimall') return;
  const res = db.claimAllDeliveries(i.user.id);
  if (res.count === 0) {
    return i.update({ embeds: [embed('📭 Inbox empty', [['', 'nothing pending to claim']], 0x2b2d31)], components: [] }).catch(() => {});
  }
  const parts = [];
  if (res.credited > 0) parts.push(`**${res.credited.toLocaleString()}** ${config.currency}`);
  if (parts.length === 0) parts.push('some goodies');
  return i.update({
    embeds: [success(`claimed ${res.count} delivery(ies) — ${parts.join(', ').replace(/^, /, '')} moved into your account`)],
    components: [],
  }).catch(() => {});
}

module.exports = {
  name: 'inbox',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'view ur mailbox (gifts + payouts waiting to be claimed)',
  aliases: ['mail', 'mailbox'],
  handleInteraction,
  execute(message) {
    const pending = db.getPendingDeliveries(message.author.id, 20);
    if (!pending.length) {
      return message.channel.send({ embeds: [embed('📭 Inbox', [['', 'empty — gifts, contract payouts and event goodies land here and wait for u to claim them']], 0x2b2d31)] });
    }
    const unreadCount = pending.filter(d => d.status === 'pending').length;
    const fields = [
      ['Unclaimed', `**${unreadCount}** delivery(ies) pending`],
      ['', 'each one is waiting for a tap — claim em all with the button or `v claim`'],
    ];
    const lines = pending.map(formatDelivery);
    fields.push(['', lines.join('\n').slice(0, 1000)]);
    if (pending.length > 20) fields.push(['', `…and ${pending.length - 20} more`]);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('inbox_claimall').setLabel(`Claim All (${unreadCount})`).setStyle(ButtonStyle.Success).setEmoji('✅'),
    );
    message.channel.send({
      embeds: [embed('📭 Inbox', fields, 0x57f287)],
      components: [row],
    }).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
    });
  },
};