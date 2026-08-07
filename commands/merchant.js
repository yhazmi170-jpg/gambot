const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const KIND_EMOJI = { pet: '🐾', gems: '💎', essence: '🔮' };

function fmtPrice(p) {
  return p >= 1000000 ? `${(p / 1000000).toFixed(1).replace(/\.0$/, '')}m` : `${(p / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

function buildStockEmbed() {
  const items = db.getMerchantItems();
  const arrival = db.getNextMerchantArrival();
  const secsLeft = Math.max(0, arrival - Math.floor(Date.now() / 1000));
  if (!items.length) {
    return embed('🛍️ Travelling Merchant', [['', `the merchant hasn't set up shop yet — check back soon!` ]], 0xe67e22);
  }
  const lines = items.map(it => {
    return `${it.sold_to ? '✅' : KIND_EMOJI[it.kind] || '🛍️'} **${it.label}** — \`${fmtPrice(it.price)}\` ${config.currency}${it.sold_to ? ' (sold)' : ''}`;
  }).join('\n');
  return embed('🛍️ Travelling Merchant', [
    ['Stock', items.length ? lines : 'restocking…'],
    ['Leaves', `<t:${arrival}:R>`],
    ['', 'one per item — first come, first served!\n`v merchant` to browse'],
  ], 0xfe7c22);
}

function buildStockRows() {
  const items = db.getMerchantItems();
  const row = [];
  for (const it of items) {
    const sold = !!it.sold_to;
    row.push(new ButtonBuilder()
      .setCustomId(`mer_${it.slot}`)
      .setLabel(`${sold ? '✅ ' : ''}${it.kind.toUpperCase()} ${fmtPrice(it.price)}`)
      .setStyle(sold ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(sold));
  }
  const rows = [];
  if (row.length) rows.push(new ActionRowBuilder().addComponents(row));
  return rows;
}

module.exports = {
  name: 'merchant',
  helpCategory: 'Shop',
  helpArgs: '',
  description: 'loot the travelling merchant — limited rare stock, first come first served',
  aliases: ['traderm', 'mrchnt'],
  execute(message) {
    message.channel.send({ embeds: [buildStockEmbed()], components: buildStockRows() });
  },
  async handleInteraction(i) {
    if (!i.customId.startsWith('mer_')) return;
    const slot = i.customId.replace('mer_', '');
    const res = db.buyMerchantItem(i.user.id, slot);
    if (res.ok) {
      const it = res.item;
      await i.reply({ embeds: [success(`you bought the merchant\u2019s **${it.label}** for **${it.price.toLocaleString()}** ${config.currency}!`)], ephemeral: true });
      i.message.edit({ embeds: [buildStockEmbed()], components: buildStockRows() }).catch(() => {});
      return;
    }
    const reasons = { coins: "you don't have enough", sold: 'someone else grabbed that already!', gone: 'the merchant already left with that item' };
    await i.reply({ embeds: [error(reasons[res.reason] || 'could not buy')], ephemeral: true });
  },
};