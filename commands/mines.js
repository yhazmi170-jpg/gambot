const db = require('../db');
const config = require('../config');
const { embed, error, parseAmount } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const activeGames = new Map();
const ROWS = 4; const COLS = 4; const BOMBS = 4;

function createGrid(bc) {
  const cells = Array(ROWS * COLS).fill(false);
  let placed = 0;
  while (placed < (bc || BOMBS)) { const i = Math.floor(Math.random() * cells.length); if (!cells[i]) { cells[i] = true; placed++; } }
  return cells;
}

function mult(gems, bombs, lucky) {
  let m = 1;
  for (let i = 0; i < gems; i++) m *= (ROWS * COLS - i) / (ROWS * COLS - bombs - i);
  const boost = lucky ? 3 + gems * 0.5 : 1.1;
  return Math.round(m * boost * 100) / 100;
}

function buildButtons(game) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const tileRow = [];
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const rev = game.revealed.has(idx);
      let emoji, style, disabled;
      if (game.hitBomb === idx) { emoji = '💥'; style = ButtonStyle.Danger; disabled = true; }
      else if (game.lastSafe === idx) { emoji = '💎'; style = ButtonStyle.Success; disabled = true; }
      else if (rev && game.bombs[idx]) { emoji = '💣'; style = ButtonStyle.Danger; disabled = true; }
      else if (rev) { emoji = '💎'; style = ButtonStyle.Primary; disabled = true; }
      else { emoji = null; style = ButtonStyle.Secondary; disabled = false; }
      const b = new ButtonBuilder().setCustomId(`m_${idx}`).setStyle(style).setDisabled(disabled);
      if (emoji) b.setEmoji(emoji);
      else b.setLabel('\u200b');
      tileRow.push(b);
    }
    rows.push(new ActionRowBuilder().addComponents(tileRow));
  }
  // dedicated 5th row for cash-out so all 16 tiles (4x4) stay clickable
  const cd = game.hitBomb !== undefined || !game.active;
  rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('m_cash').setEmoji('💰').setStyle(cd ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(cd)));
  return rows;
}

function buildContainer(game, outcome) {
  const rc = game.revealed.size;
  const b = game.bombCount;
  const bet = game.bet;
  const lines = [];
  lines.push(`${game.testMode ? '🧪 ' : '💣 '}Mines${game.testMode ? ' [TEST MODE]' : ''}  |  Bet: \`${bet.toLocaleString()}\`  |  Mines: \`${b}\``);
  if (outcome) {
    lines.push('', outcome);
  } else {
    if (rc > 0) {
      const curMult = mult(rc, b, game.lucky);
      const curPayout = Math.floor(game.bet * curMult);
      const curPaid = Math.floor((curPayout - game.bet) * db.getBalanceFactor(game.userId)) + game.bet;
      const cutNote = curPaid < curPayout ? ` (${(curPaid / game.bet).toFixed(2)}× after balance cut)` : '';
      lines.push('', `Cash Out: \`${curPaid.toLocaleString()} (${curMult.toFixed(2)}×)\`${cutNote}`);
    }
    if (rc < ROWS * COLS - b) {
      const nextMult = mult(rc + 1, b, game.lucky);
      const nextPayout = Math.floor(game.bet * nextMult);
      const nextPaid = Math.floor((nextPayout - game.bet) * db.getBalanceFactor(game.userId)) + game.bet;
      const cutNote = nextPaid < nextPayout ? ` (${(nextPaid / game.bet).toFixed(2)}× after balance cut)` : '';
      lines.push(`Next: \`${nextPaid.toLocaleString()} (${nextMult.toFixed(2)}×)\`${cutNote}`);
    }
    if (rc >= ROWS * COLS - b) lines.push('All gems cleared!');
    lines.push(`Gems: **${rc}**`);
    if (rc === 0 && !game.hasCustomMines) lines.push('', `_\`v mines <bet> <mines>\` to set mine count_`);
  }
  const color = outcome ? (outcome.includes('Cashed Out') || outcome.includes('Cleared') ? 0x57f287 : 0xed4245) : 0x2b2d31;
  return { embeds: [embed('💣 Mines', [['', lines.join('\n')]], color)], components: buildButtons(game) };
}

module.exports = {
  name: 'mines',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'reveal tiles, avoid mines',
  aliases: ['mine'],
  execute(message, args) {
    let testMode = false;
    let amount;
    try {
      if ((args[0] || '').toLowerCase() === 'test') {
        if (message.author.id !== config.ownerId) return;
        testMode = true;
        args.shift();
      }

      let amount;
      if ((args[0] || '').toLowerCase() === 'all' && !testMode) { const u = db.ensureUser(message.author.id); amount = Math.min(u.balance, db.getMaxBet(message.author.id)); if (amount <= 0) return message.channel.send({ embeds: [error('you have no money')] }); }
      else { amount = parseAmount(args[0]); if (isNaN(amount) || amount <= 0) amount = testMode ? 1000 : undefined; if (amount === undefined) return message.channel.send({ embeds: [error('bet an amount or use `all`')] }); }

      // Enforce max bet limit
      if (!testMode) {
        const maxBet = db.getMaxBet(message.author.id);
        if (amount > maxBet) return message.channel.send({ embeds: [error(`max bet is **${maxBet.toLocaleString()}** — upgrade with bet cap perks in the shop`)] });
      }

      const user = db.ensureUser(message.author.id);
      if (!testMode && user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });
      if (activeGames.has(message.author.id)) return message.channel.send({ embeds: [error('you already have an active mines game')] });

      if (!testMode) {
        db.addBalance(message.author.id, -amount);
        db.addGambled(message.author.id, amount);
      }

      const lucky = db.ensureUser(message.author.id).lucky;
      const customMines = parseInt(args[1]);
      const hasCustomMines = !isNaN(customMines) && customMines >= 1 && customMines <= 15;
      let bombCount;
      if (hasCustomMines) {
        bombCount = customMines;
      } else {
        bombCount = lucky ? 1 : BOMBS;
      }
      const game = { bombs: createGrid(bombCount), bombCount, revealed: new Set(), bet: amount, active: true, lastSafe: -1, hitBomb: undefined, testMode, lucky, hasCustomMines, userId: message.author.id };
      activeGames.set(message.author.id, game);

      message.channel.send(buildContainer(game)).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
      const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      col.on('collect', async (i) => {
        if (!game.active) { await i.deferUpdate().catch(() => {}); return; }
        if (i.customId === 'm_cash') {
          game.active = false; activeGames.delete(message.author.id);
          const p = Math.floor(game.bet * mult(game.revealed.size, game.bombCount, game.lucky));
          const paid = game.testMode ? (p - game.bet) : db.payWin(message.author.id, p - game.bet, game.bet);
          const total = game.bet + paid;
          const gotMult = game.testMode ? '' : ` — got **${(total / game.bet).toFixed(2)}×**${paid < p - game.bet ? ' (balance cut)' : ''}`;
          return i.update({ embeds: [embed('💣 Mines', [['', `${game.testMode ? '🧪' : '💣'} Cashed Out${game.testMode ? ' [TEST]' : ''}\n\n**${total.toLocaleString()}** ${config.currency} (+**${paid}**)${gotMult}${game.testMode ? ' (no money gained)' : ''}`]], 0x57f287)] }).catch(() => {});
        }
        const idx = parseInt(i.customId.split('_')[1]);
        if (game.revealed.has(idx)) { await i.deferUpdate().catch(() => {}); return; }
        if (game.bombs[idx]) {
          game.active = false; game.hitBomb = idx; activeGames.delete(message.author.id);
          for (let j = 0; j < ROWS * COLS; j++) game.revealed.add(j);
          let refund = 0;
          if (!game.testMode) {
            refund = db.getInsuranceRefund(message.author.id, game.bet);
            if (refund > 0) db.addBalance(message.author.id, refund);
          }
          const lines = [`${game.testMode ? '🧪' : '💥'} Touched a mine!${game.testMode ? ' [TEST]' : ''}\n\nLost **${game.bet.toLocaleString()}** ${config.currency}${refund > 0 ? ` (refund **${refund}**)` : ''}${game.testMode ? ' (no money lost)' : ''}`];
          return i.update({ embeds: [embed('💣 Mines', [['', lines.join('\n')]], 0xed4245)], components: buildButtons(game) }).catch(() => {});
        }
        game.revealed.add(idx); game.lastSafe = idx;
        const rc = game.revealed.size;
        if (rc >= ROWS * COLS - game.bombCount) {
          game.active = false; activeGames.delete(message.author.id);
          const p = Math.floor(game.bet * mult(rc, game.bombCount, game.lucky));
          const paid = game.testMode ? (p - game.bet) : db.payWin(message.author.id, p - game.bet, game.bet);
          const total = game.bet + paid;
          const gotMult = game.testMode ? '' : ` — got **${(total / game.bet).toFixed(2)}×**${paid < p - game.bet ? ' (balance cut)' : ''}`;
          for (let j = 0; j < ROWS * COLS; j++) game.revealed.add(j);
          const lines = [`${game.testMode ? '🧪' : '💣'} All Cleared!${game.testMode ? ' [TEST]' : ''}\n\n**${total.toLocaleString()}** ${config.currency} (+**${paid}**)${gotMult}${game.testMode ? ' (no money gained)' : ''}`];
          return i.update({ embeds: [embed('💣 Mines', [['', lines.join('\n')]], 0x57f287)], components: buildButtons(game) }).catch(() => {});
        }
        i.update(buildContainer(game)).catch(() => {});
      });
      col.on('end', () => {
        if (game.active) {
          game.active = false; activeGames.delete(message.author.id);
          if (!game.testMode) db.addBalance(message.author.id, game.bet); // refund an unplayed game instead of eating the bet
          msg.edit({ embeds: [embed('💣 Mines', [['', '⏰ Game timed out (no moves for 5 min) — your bet was **refunded**.']], 0x2b2d31)], components: [] }).catch(() => {});
        }
      });
    }).catch(err => {
      activeGames.delete(message.author.id);
      if (!game.testMode) db.addBalance(message.author.id, game.bet);
      console.error('mines send error:', err);
      message.channel.send({ embeds: [error('failed to start mines game')] }).catch(() => {});
    });
    } catch (err) {
      activeGames.delete(message.author.id);
      if (!testMode) db.addBalance(message.author.id, amount);
      console.error('mines execute error:', err);
      message.channel.send({ embeds: [error('something went wrong starting mines')] }).catch(() => {});
    }
  },
};
