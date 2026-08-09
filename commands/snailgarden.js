const db = require('../db');
const config = require('../config');
const { embed, error, parseAmount } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const activeGames = new Map();
const MAX_STEPS = 10;

function multAt(steps) {
  return Math.round(Math.pow(1.25, steps) * 100) / 100;
}

function failChanceAt(steps) {
  return Math.min(10 + steps * 5, 95);
}

function computeContainer(game, extraSteps) {
  const steps = game.completed + extraSteps;
  const m = multAt(steps);
  const profit = Math.floor(game.bet * m) - game.bet;
  const paid = Math.floor(profit * db.getBalanceFactor(game.userId));
  const total = game.bet + paid;
  return { m, profit, paid, total };
}

function buildButtons(game) {
  const ended = !game.active;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sg_next').setEmoji('🌱').setLabel('Next row').setStyle(ButtonStyle.Success).setDisabled(ended),
    new ButtonBuilder().setCustomId('sg_cash').setEmoji('💰').setLabel('Sell').setStyle(ButtonStyle.Secondary).setDisabled(ended)
  );
  return [row];
}

function buildContainer(game, outcome) {
  const lines = [];
  lines.push(`🌻 <@${game.userId}>'s snail finished planting the garden${game.testMode ? ' [TEST]' : ''}!`);
  lines.push(`Bet: \`${game.bet.toLocaleString()}\`   Steps: \`${game.completed}\`   Failure Chance: \`${game.completed >= MAX_STEPS ? '—' : failChanceAt(game.completed).toFixed(2) + '%'}\``);
  if (outcome) {
    lines.push('', outcome);
  } else {
    if (game.completed > 0) {
      const cur = computeContainer(game, 0);
      const cut = db.getBalanceFactor(game.userId) < 1 ? ` (real **${cur.mult}×** after balance cut)` : '';
      lines.push(`Cash Out: \`${cur.total.toLocaleString()} (${cur.m.toFixed(2)}×)\`${cut}`);
    }
    if (game.completed < MAX_STEPS) {
      const nxt = computeContainer(game, 1);
      lines.push(`Next: \`${nxt.total.toLocaleString()} (${nxt.m.toFixed(2)}×)\``);
    }
    if (game.completed >= MAX_STEPS) lines.push('The garden is fully planted!');
    const parked = '🌻'.repeat(game.completed);
    const remaining = '🟩'.repeat(MAX_STEPS - game.completed);
    lines.push('', `${parked}${remaining || '🟨'}`);
    lines.push('plant a row to grow the multiplier — failure ends the game');
  }
  const color = outcome ? (outcome.includes('refunded') || outcome.includes('sold') ? 0x57f287 : 0xed4245) : 0x2b2d31;
  return { embeds: [embed('🌻 Snail Garden', [['', lines.join('\n')]], color)], components: buildButtons(game) };
}

module.exports = {
  name: 'snailgarden',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'plant rows step by step — cash out before a row fails',
  aliases: ['sgarden', 'gardenbet'],
  execute(message, args) {
    let amount;
    try {
      if ((args[0] || '').toLowerCase() === 'all') {
        const u = db.ensureUser(message.author.id);
        amount = Math.min(u.balance, db.getMaxBet(message.author.id));
        if (amount <= 0) return message.channel.send({ embeds: [error('you have no money')] });
      } else {
        amount = parseAmount(args[0]);
        if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('bet an amount or use `all`')] });
      }

      const user = db.ensureUser(message.author.id);
      if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });
      if (activeGames.has(message.author.id)) return message.channel.send({ embeds: [error('you already have an active snail garden')] });

      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);

      const game = { bet: amount, completed: 0, active: true, testMode: false, lucky: db.ensureUser(message.author.id).lucky, userId: message.author.id, username: message.author.username };
      activeGames.set(message.author.id, game);

      message.channel.send(buildContainer(game)).then(msg => {
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
        col.on('collect', async (i) => {
          if (!game.active) { await i.deferUpdate().catch(() => {}); return; }
          if (i.customId === 'sg_cash') {
            game.active = false; activeGames.delete(message.author.id);
            const cur = computeContainer(game, 0);
            const paid = db.payWin(message.author.id, cur.profit, game.bet);
            const total = game.bet + paid;
            const cut = paid < cur.profit ? ` — got **${(total / game.bet).toFixed(2)}×** (balance cut)` : '';
            game.outcome = `Sold the garden for **${total.toLocaleString()}** ${config.currency} (+**${paid}**)${cut}`;
            return i.update(buildContainer(game, game.outcome)).catch(() => {});
          }
          if (i.customId === 'sg_next') {
            const chance = failChanceAt(game.completed);
            const fail = Math.random() * 100 < chance;
            if (fail) {
              game.active = false; activeGames.delete(message.author.id);
              let refund = 0;
              refund = db.getInsuranceRefund(message.author.id, game.bet);
              if (refund > 0) db.addBalance(message.author.id, refund);
              game.completed++;
              game.outcome = `The garden failed to plant next row! Lost **${game.bet.toLocaleString()}** ${config.currency}${refund > 0 ? ` (🛡️ **${refund.toLocaleString()}** refunded)` : ''}`;
              return i.update(buildContainer(game, game.outcome)).catch(() => {});
            }
            game.completed++;
            if (game.completed >= MAX_STEPS) {
              game.active = false; activeGames.delete(message.author.id);
              const cur = computeContainer(game, 0);
              const paid = db.payWin(message.author.id, cur.profit, game.bet);
              const total = cur.total;
              const finalTotal = game.bet + paid;
              const cut = paid < cur.profit ? ` (return **${(finalTotal / game.bet).toFixed(2)}×** after balance cut)` : '';
              game.outcome = `Garden fully planted! You sold for **${finalTotal.toLocaleString()}** ${config.currency} (+**${paid}**)${cut}`;
              return i.update(buildContainer(game, game.outcome)).catch(() => {});
            }
            i.update(buildContainer(game)).catch(() => {});
          }
        });
        col.on('end', () => {
          if (game.active) {
            game.active = false; activeGames.delete(message.author.id);
            db.addBalance(message.author.id, game.bet); // refund an untouched garden
            msg.edit({ embeds: [embed('🌻 Snail Garden', [['', '⏰ Game timed out (no moves for 5 min) — your bet was **refunded**.']], 0x2b2d31)], components: [] }).catch(() => {});
          }
        });
      }).catch(err => {
        activeGames.delete(message.author.id);
        db.addBalance(message.author.id, amount);
        console.error('snailgarden send error:', err);
        message.channel.send({ embeds: [error('failed to start snail garden')] }).catch(() => {});
      });
    } catch (err) {
      activeGames.delete(message.author.id);
      if (amount) db.addBalance(message.author.id, amount);
      console.error('snailgarden execute error:', err);
      message.channel.send({ embeds: [error('something went wrong starting snail garden')] }).catch(() => {});
    }
  },
};