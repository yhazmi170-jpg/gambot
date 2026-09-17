const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function parseDuration(str) {
  if (!str || typeof str !== 'string') return NaN;
  const m = String(str).toLowerCase().match(/^(\d+(?:\.\d+)?)(s|m|h|d)?$/);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const unit = m[2] || 'm';
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return Math.floor(n * mult);
}

module.exports = {
  name: 'giveaway',
  helpCategory: 'Economy',
  helpArgs: '<time> <prize> [winners] [split|full]',
  aliases: ['gw', 'gaw'],
  description: 'host a giveaway — winners drawn at the end; \`split\` divides the prize, \`full\` gives every winner the whole prize; payouts land in the inbox',
  async execute(message, args) {
    const userId = message.author.id;
    const duration = parseDuration(args[0]);
    const prize = parseAmount(args[1]);
    if (isNaN(duration) || duration < 30000) return message.channel.send({ embeds: [error('give a duration (min 30s) — e.g. \`v giveaway 10m 500k\`')] });
    if (duration > 86400000 * 7) return message.channel.send({ embeds: [error('giveaways can\'t run longer than 7 days')] });
    if (isNaN(prize) || prize <= 0) return message.channel.send({ embeds: [error('enter a valid prize — e.g. \`v giveaway 10m 500k\`')] });

    let winners = 1;
    if (args[2] !== undefined) {
      winners = parseInt(args[2], 10);
      if (!Number.isFinite(winners) || winners < 1 || winners > 50) return message.channel.send({ embeds: [error('how many winners? 1–50 — e.g. \`v giveaway 24h 100m 10 split\`')] });
    }
    let mode = (args[3] || 'split').toLowerCase();
    if (winners === 1) mode = 'split';
    if (mode !== 'split' && mode !== 'full') return message.channel.send({ embeds: [error('mode must be \`split\` (divide the prize) or \`full\` (whole prize to every winner)')] });

    const perWinner = Math.floor(prize / winners);
    const hostCost = mode === 'full' ? prize * winners : prize;

    const bal = db.getBalance(userId);
    if (bal < hostCost) return message.channel.send({ embeds: [error(`you need **${hostCost.toLocaleString()}** ${config.currency} to host this giveaway (you have **${bal.toLocaleString()}**)`)] });

    db.addBalance(userId, -hostCost);

    const enterBtn = new ButtonBuilder().setCustomId(`gw_${userId}`).setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji('🎉');
    const row = new ActionRowBuilder().addComponents(enterBtn);
    const entries = new Set();
    const hostId = userId;

    const endsAt = Date.now() + duration;

    const prizeField = mode === 'full'
      ? `**${prize.toLocaleString()}** ${config.currency} each`
      : (winners > 1
        ? `**${prize.toLocaleString()}** ${config.currency} split across ${winners} → **${perWinner.toLocaleString()}** each`
        : `**${prize.toLocaleString()}** ${config.currency}`);

    const buildEmbed = (statusLine) => embed('🎉 Giveaway', [
      ['Host', `<@${hostId}>`],
      ['Prize', prizeField],
      ['Winners', `${winners} — ${mode}`],
      ['Ends', `<t:${Math.floor(endsAt / 1000)}:R>`],
      ['Entries', `${entries.size} so far — click 🎉 **Enter** to join!`],
      ['', statusLine],
    ], 0x57f287);

    const msg = await message.channel.send({ embeds: [buildEmbed('')], components: [row] });

    // persist so the winners are always drawn + announced even after a restart
    db.createGiveaway(msg.id, message.channel.id, hostId, prize, Math.floor(endsAt / 1000), winners, mode);

    const filter = i => i.customId === `gw_${hostId}` && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: duration });

    col.on('collect', async (i) => {
      entries.add(i.user.id);
      db.addGiveawayEntry(msg.id, i.user.id);
      await i.update({ embeds: [buildEmbed('')], components: [row] }).catch(() => {});
      if (i.user.id !== hostId) {
        i.user.send(`🎉 you entered the giveaway! winners get their prize in the inbox — claim it with \`v inbox\`.`).catch(() => {});
      }
    });

    // finalization (draw winners, pay into inbox, edit, announce) is handled by the sweep in index.js
    col.on('end', async () => {});
  },
};
