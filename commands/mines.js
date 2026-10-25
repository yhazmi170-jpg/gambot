const db = require('../db');
const config = require('../config');
const { embed, error, parseAmount } = require('../utils/embed');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const activeGames = new Map();
const ROWS = 3; const COLS = 3; const BOMBS = 3;

function createGrid(bc) {
  const cells = Array(ROWS * COLS).fill(false);
  let placed = 0;
  while (placed < (bc || BOMBS)) { const i = Math.floor(Math.random() * cells.length); if (!cells[i]) { cells[i] = true; placed++; } }
  return cells;
}

function mult(gems, bombs) {
  if (gems === 0) return 1;
  let m = 1;
  const total = ROWS * COLS;
  for (let i = 0; i < gems; i++) m *= (total - i) / (total - bombs - i);
  const boost = 0.98;
  return Math.max(1.05, Math.round(m * boost * 100) / 100);
}

function buildContainer(game) {
  const rc = game.revealed.size;
  const b = game.bombCount;
  const bet = game.bet;

  let header;
  let color;

  if (game.outcomeType === 'bomb') {
    color = 0xed4245;
    const nextMult = mult(rc + 1, b);
    const nextPayout = Math.floor(game.bet * nextMult);
    const nextPaid = Math.floor((nextPayout - game.bet) * db.getBalanceFactor(game.userId)) + game.bet;
    const refund = game.refund || 0;
    const lines = [
      `### 💥 <@${game.userId}> touched a mine!`,
      `-# **Bet**: \`${bet.toLocaleString()}\`    **Mines**: \`${b}\``,
      `-# ~~**Cash Out**: \`0\` \`(0.00x)\`~~`,
      `-# ~~**Next**: \`${nextPaid.toLocaleString()}\` \`(${nextMult.toFixed(2)}x)\`~~`,
    ];
    if (refund > 0) {
      lines.push(`-# 🛡️ **Insurance Refund**: \`${refund.toLocaleString()}\``);
    }
    header = lines.join('\n');
  } else if (game.outcomeType === 'cashout') {
    color = 0x57f287;
    const total = game.total;
    const paid = game.paid;
    const lines = [
      `### 💰 <@${game.userId}> cashed out!`,
      `-# **Bet**: \`${bet.toLocaleString()}\`    **Mines**: \`${b}\``,
      `-# **Cashed Out**: \`${total.toLocaleString()}\` \`(${(total / game.bet).toFixed(2)}x)\``,
      `-# **Profit**: \`+${paid.toLocaleString()}\``,
    ];
    header = lines.join('\n');
  } else if (game.outcomeType === 'cleared') {
    color = 0x57f287;
    const total = game.total;
    const paid = game.paid;
    const lines = [
      `### 🎉 <@${game.userId}> cleared all mines!`,
      `-# **Bet**: \`${bet.toLocaleString()}\`    **Mines**: \`${b}\``,
      `-# **Payout**: \`${total.toLocaleString()}\` \`(${(total / game.bet).toFixed(2)}x)\``,
      `-# **Profit**: \`+${paid.toLocaleString()}\``,
    ];
    header = lines.join('\n');
  } else {
    color = rc > 0 ? 0x57f287 : 0x5865f2;
    const curMult = mult(rc, b);
    const curPayout = Math.floor(game.bet * curMult);
    const curPaid = rc > 0 ? Math.floor((curPayout - game.bet) * db.getBalanceFactor(game.userId)) + game.bet : 0;
    const safeGems = ROWS * COLS - b;
    const nextMult = mult(rc + 1, b);
    const nextPayout = Math.floor(game.bet * nextMult);
    const nextPaid = Math.floor((nextPayout - game.bet) * db.getBalanceFactor(game.userId)) + game.bet;

    const lines = [
      `### 💣 <@${game.userId}> is playing a mines game.`,
      `-# **Bet**: \`${bet.toLocaleString()}\`    **Mines**: \`${b}\``,
      `-# **Cash Out**: \`${curPaid.toLocaleString()}\` \`(${curMult.toFixed(2)}x)\``,
      `-# **Next**: \`${nextPaid.toLocaleString()}\` \`(${nextMult.toFixed(2)}x)\``,
    ];
    header = lines.join('\n');
  }

  const gridRows = [];
  for (let r = 0; r < ROWS; r++) {
    const tileRow = [];
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const rev = game.revealed.has(idx);
      let emoji, style, disabled;
      if (game.hitBomb === idx) {
        emoji = '💥'; style = ButtonStyle.Danger; disabled = true;
      } else if (rev && game.bombs[idx]) {
        emoji = '💣'; style = ButtonStyle.Danger; disabled = true;
      } else if (rev) {
        emoji = '💎'; style = ButtonStyle.Primary; disabled = true;
      } else {
        emoji = '1563723503981699205'; style = ButtonStyle.Secondary; disabled = !game.active;
      }
      const b = new ButtonBuilder().setCustomId(`m_${idx}`).setStyle(style).setDisabled(disabled);
      if (emoji) b.setEmoji(emoji);
      tileRow.push(b);
    }
    gridRows.push(new ActionRowBuilder().addComponents(tileRow));
  }

  const canCashOut = game.active && game.revealed.size > 0 && game.hitBomb === undefined;
  const cashRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('m_cash')
      .setLabel('Cash Out')
      .setEmoji('💵')
      .setStyle(canCashOut ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!canCashOut)
  );

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

  for (const row of gridRows) {
    container.addActionRowComponents(row);
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
  container.addActionRowComponents(cashRow);

  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  };
}

module.exports = {
  name: 'mines',
  helpCategory: 'Games',
  helpArgs: '<amount> [mines]',
  description: 'reveal tiles, avoid mines',
  aliases: ['mine', 'm'],
  execute(message, args) {
    let testMode = false;
    let amount;
    try {
      if ((args[0] || '').toLowerCase() === 'test') {
        if (!config.isOwner(message.author.id)) return;
        testMode = true;
        args.shift();
      }

      const u = db.ensureUser(message.author.id);
      if (!u) return message.channel.send({ embeds: [error('you need to accept terms first — `v agree`')] });
      if ((args[0] || '').toLowerCase() === 'all' && !testMode) { amount = Math.min(u.balance, db.getMaxBet(message.author.id)); if (amount <= 0) return message.channel.send({ embeds: [error('you have no money')] }); }
      else { amount = parseAmount(args[0]); if (isNaN(amount) || amount <= 0) amount = testMode ? 1000 : undefined; if (amount === undefined) return message.channel.send({ embeds: [error('bet an amount or use `all`')] }); }

      if (!testMode) {
        const maxBet = db.getMaxBet(message.author.id);
        if (amount > maxBet) return message.channel.send({ embeds: [error(`max bet is **${maxBet.toLocaleString()}** — upgrade with bet cap perks in the shop`)] });
      }

      const user = db.ensureUser(message.author.id);
      if (!user) return message.channel.send({ embeds: [error('you need to accept terms first — `v agree`')] });
      if (!testMode && user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });
      if (activeGames.has(message.author.id)) return message.channel.send({ embeds: [error('you already have an active mines game')] });

      if (!testMode) {
        db.addBalance(message.author.id, -amount);
        db.addGambled(message.author.id, amount);
      }

      const customMines = parseInt(args[1]);
      const hasCustomMines = !isNaN(customMines) && customMines >= 1 && customMines <= 8;
      let bombCount;
      if (hasCustomMines) {
        bombCount = customMines;
      } else {
        bombCount = BOMBS;
      }
      const game = { bombs: createGrid(bombCount), bombCount, revealed: new Set(), bet: amount, active: true, lastSafe: -1, hitBomb: undefined, testMode, hasCustomMines, userId: message.author.id };
      activeGames.set(message.author.id, game);

      message.channel.send(buildContainer(game)).then(msg => {
        if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
        setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
        col.on('collect', async (i) => {
          if (!game.active) { await i.deferUpdate().catch(() => {}); return; }
          if (i.customId === 'm_cash') {
            if (game.revealed.size === 0) { await i.deferUpdate().catch(() => {}); return; }
            game.active = false; activeGames.delete(message.author.id);
            const p = Math.floor(game.bet * mult(game.revealed.size, game.bombCount));
            const paid = game.testMode ? (p - game.bet) : db.payWin(message.author.id, p - game.bet, game.bet);
            const total = game.bet + paid;
            for (let j = 0; j < ROWS * COLS; j++) game.revealed.add(j);
            game.outcomeType = 'cashout';
            game.total = total;
            game.paid = paid;
            game.p = p;
            return i.update(buildContainer(game)).catch(() => {});
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
            game.outcomeType = 'bomb';
            game.refund = refund;
            return i.update(buildContainer(game)).catch(() => {});
          }
          game.revealed.add(idx); game.lastSafe = idx;
          const rc = game.revealed.size;
          if (rc >= ROWS * COLS - game.bombCount) {
            game.active = false; activeGames.delete(message.author.id);
            const p = Math.floor(game.bet * mult(rc, game.bombCount));
            const paid = game.testMode ? (p - game.bet) : db.payWin(message.author.id, p - game.bet, game.bet);
            const total = game.bet + paid;
            for (let j = 0; j < ROWS * COLS; j++) game.revealed.add(j);
            game.outcomeType = 'cleared';
            game.total = total;
            game.paid = paid;
            return i.update(buildContainer(game)).catch(() => {});
          }
          i.update(buildContainer(game)).catch(() => {});
        });
        col.on('end', () => {
          if (game.active) {
            game.active = false; activeGames.delete(message.author.id);
            if (!game.testMode) db.addBalance(message.author.id, game.bet);
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
