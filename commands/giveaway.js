const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
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
  helpArgs: '<time> <prize>',
  aliases: ['gw', 'gaw'],
  description: 'host a giveaway — entry button, random winner gets the prize',
  async execute(message, args) {
    const userId = message.author.id;
    const duration = parseDuration(args[0]);
    const prize = parseAmount(args[1]);
    if (isNaN(duration) || duration < 30000) return message.channel.send({ embeds: [error('give a duration (min 30s) — e.g. \`v giveaway 10m 500k\`')] });
    if (duration > 86400000 * 7) return message.channel.send({ embeds: [error('giveaways can\'t run longer than 7 days')] });
    if (isNaN(prize) || prize <= 0) return message.channel.send({ embeds: [error('enter a valid prize — e.g. \`v giveaway 10m 500k\`')] });

    const bal = db.getBalance(userId);
    if (bal < prize) return message.channel.send({ embeds: [error(`you need **${prize.toLocaleString()}** ${config.currency} to host this giveaway (you have **${bal.toLocaleString()}**)`)] });

    db.addBalance(userId, -prize);

    const enterBtn = new ButtonBuilder().setCustomId('gw_enter').setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji('🎉');
    const row = new ActionRowBuilder().addComponents(enterBtn);
    const entries = new Set();
    const hostId = userId;

    const endsAt = Date.now() + duration;
    const fmt = (ms) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : '', `${sec}s`].filter(Boolean).join(' ');
    };

    const buildEmbed = (statusLine) => embed('🎉 Giveaway', [
      ['Host', `<@${hostId}>`],
      ['Prize', `**${prize.toLocaleString()}** ${config.currency}`],
      ['Ends', `<t:${Math.floor(endsAt / 1000)}:R>`],
      ['Entries', `${entries.size} so far — click 🎉 **Enter** to join!`],
      ['', statusLine],
    ], 0x57f287);

    const msg = await message.channel.send({ embeds: [buildEmbed('')], components: [row] });

    const filter = i => i.customId === 'gw_enter' && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: duration });

    col.on('collect', async (i) => {
      entries.add(i.user.id);
      await i.update({ embeds: [buildEmbed('')], components: [row] }).catch(() => {});
      if (i.user.id !== hostId) {
        i.user.send(`🎉 you entered the giveaway for **${prize.toLocaleString()}** ${config.currency}!`).catch(() => {});
      }
    });

    col.on('end', async () => {
      const eligible = [...entries].filter(id => id !== hostId);
      if (!eligible.length) {
        db.addBalance(hostId, prize);
        await msg.edit({ embeds: [embed('🎉 Giveaway Ended', [
          ['Host', `<@${hostId}>`],
          ['Prize', `**${prize.toLocaleString()}** ${config.currency}`],
          ['Result', 'nobody entered — prize returned to the host'],
        ], 0xed4245)], components: [] }).catch(() => {});
        return;
      }
      const winnerId = eligible[Math.floor(Math.random() * eligible.length)];
      db.addBalance(winnerId, prize);
      await msg.edit({ embeds: [embed('🎉 Giveaway Ended', [
        ['Host', `<@${hostId}>`],
        ['Prize', `**${prize.toLocaleString()}** ${config.currency}`],
        ['Entries', `${eligible.length} participants`],
        ['Winner', `🎊 **<@${winnerId}>** won **${prize.toLocaleString()}** ${config.currency}!`],
      ], 0x57f287)], components: [] }).catch(() => {});
      message.channel.send(`🎉 congratulations <@${winnerId}> — you won **${prize.toLocaleString()}** ${config.currency} from <@${hostId}>'s giveaway!`).catch(() => {});
    });
  },
};
