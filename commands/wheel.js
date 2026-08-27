const db = require('../db');
const config = require('../config');
const { embed, error } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const activeGames = new Map();

const SEGMENTS = [
  { mult: 0, weight: 28, label: '💀 x0' },
  { mult: 0.5, weight: 16, label: '🥉 x0.5' },
  { mult: 1, weight: 12, label: '🎟️ x1' },
  { mult: 1.5, weight: 8, label: '🥈 x1.5' },
  { mult: 2, weight: 6, label: '🥇 x2' },
  { mult: 3, weight: 4, label: '💎 x3' },
  { mult: 5, weight: 2, label: '👑 x5' },
  { mult: 10, weight: 1, label: '🌌 x10 JACKPOT' },
];

function spin() {
  const total = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let roll = Math.random() * total;
  for (const seg of SEGMENTS) {
    roll -= seg.weight;
    if (roll <= 0) return seg;
  }
  return SEGMENTS[SEGMENTS.length - 1];
}

module.exports = {
  name: 'wheel',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'spin the wheel — multipliers up to x10 jackpot',
  aliases: ['spin'],
  execute(message, args) {
    const userId = message.author.id;
    const { amount, error: betError } = db.parseBet(userId, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });
    if (db.ensureUser(userId).balance < amount) return message.channel.send({ embeds: [error('not enough money')] });
    if (activeGames.has(userId)) return message.channel.send({ embeds: [error('you already have an active wheel spin')] });

    db.addBalance(userId, -amount);
    db.addGambled(userId, amount);

    const game = { bet: amount, active: true };
    activeGames.set(userId, game);

    const buildEmbed = (result) => {
      const lines = SEGMENTS.map(s => s.label).join(' · ');
      const eff = db.effectiveMult(userId, 1);
      const effNote = eff < 1 ? `\n(win payouts reduced by balance cut — real x${eff} on a x1 segment)` : '';
      return embed('🎡 Wheel of Fortune', [
        ['Bet', `**${amount.toLocaleString()}** ${config.currency}`],
        ['Wheel', lines],
        ['', result || `press **Spin** — x1 pays back your bet${effNote}`],
      ], result ? (result.includes('won') ? 0x57f287 : result.includes('lost') ? 0xed4245 : 0x2b2d31) : 0x2b2d31);
    };

    const spinBtn = new ButtonBuilder().setCustomId('w_spin').setLabel('Spin').setStyle(ButtonStyle.Success).setEmoji('🎡');
    const row = new ActionRowBuilder().addComponents(spinBtn);

    message.channel.send({ embeds: [buildEmbed('')], components: [row] }).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
      const col = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 120000 });
      col.on('collect', async (i) => {
        if (!game.active) { await i.deferUpdate().catch(() => {}); return; }
        if (i.customId !== 'w_spin') { await i.deferUpdate().catch(() => {}); return; }
        game.active = false; activeGames.delete(userId);
        const seg = spin();
        const payout = Math.floor(game.bet * seg.mult);
        if (seg.mult === 0) {
          let refund = db.getInsuranceRefund(userId, game.bet);
          if (refund > 0) db.addBalance(userId, refund);
          const r = `💀 **${seg.label}** — you lost **${game.bet.toLocaleString()}** ${config.currency}${refund > 0 ? ` (insurance refund **${refund.toLocaleString()}**)` : ''}`;
          return i.update({ embeds: [buildEmbed(r)], components: [] }).catch(() => {});
        }
        const paid = db.payWin(userId, payout - game.bet, game.bet);
        const total = game.bet + paid;
        const cut = paid < payout - game.bet ? ' (balance cut)' : '';
        const r = `🎉 **${seg.label}** — you won **${total.toLocaleString()}** ${config.currency} (+**${paid.toLocaleString()}**)${cut}`;
        return i.update({ embeds: [buildEmbed(r)], components: [] }).catch(() => {});
      });
      col.on('end', () => {
        if (game.active) {
          game.active = false; activeGames.delete(userId);
          db.addBalance(userId, game.bet);
          msg.edit({ embeds: [embed('🎡 Wheel of Fortune', [['', '⏰ Spin timed out — your bet was **refunded**.']])], components: [] }).catch(() => {});
        }
      });
    }).catch(err => {
      activeGames.delete(userId);
      db.addBalance(userId, amount);
      console.error('wheel send error:', err);
      message.channel.send({ embeds: [error('failed to start wheel')] }).catch(() => {});
    });
  },
};