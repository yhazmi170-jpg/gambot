const db = require('../db');
const config = require('../config');
const { parseAmount } = require('../utils/embed');
const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

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
    const comps = [];
    const maxC = r === ROWS - 1 ? COLS - 1 : COLS;
    for (let c = 0; c < maxC; c++) {
      const idx = r * COLS + c;
      const rev = game.revealed.has(idx);
      let emoji, style, disabled;
      if (game.hitBomb === idx) { emoji = '💥'; style = ButtonStyle.Danger; disabled = true; }
      else if (game.lastSafe === idx) { emoji = '💎'; style = ButtonStyle.Success; disabled = true; }
      else if (rev && game.bombs[idx]) { emoji = '💣'; style = ButtonStyle.Danger; disabled = true; }
      else if (rev) { emoji = '💎'; style = ButtonStyle.Primary; disabled = true; }
      else { emoji = '⬜'; style = ButtonStyle.Secondary; disabled = false; }
      comps.push(new ButtonBuilder().setCustomId(`m_${idx}`).setEmoji(emoji).setStyle(style).setDisabled(disabled));
    }
    if (r === ROWS - 1) {
      const cd = game.hitBomb !== undefined || !game.active;
      comps.push(new ButtonBuilder().setCustomId('m_cash').setEmoji('💰').setStyle(cd ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(cd));
    }
    rows.push(new ActionRowBuilder().addComponents(comps));
  }
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
      const curPayout = Math.floor(bet * mult(rc, b, game.lucky));
      lines.push('', `Cash Out: \`${curPayout.toLocaleString()} (${mult(rc, b, game.lucky).toFixed(2)}×)\``);
    }
    if (rc < ROWS * COLS - b) {
      const nextPayout = Math.floor(bet * mult(rc + 1, b, game.lucky));
      lines.push(`Next: \`${nextPayout.toLocaleString()} (${mult(rc + 1, b, game.lucky).toFixed(2)}×)\``);
    }
    if (rc >= ROWS * COLS - b) lines.push('All gems cleared!');
    lines.push(`Gems: **${rc}**`);
    if (rc === 0 && !game.hasCustomMines) lines.push('', `_\`v mines <bet> <mines>\` to set mine count_`);
  }
  return new ContainerBuilder()
    .setAccentColor(outcome ? (outcome.includes('Cashed Out') || outcome.includes('Cleared') ? 0x57f287 : 0xed4245) : 0x2b2d31)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addActionRowComponents(...buildButtons(game));
}

module.exports = {
  name: 'mines',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'reveal tiles, avoid mines',
  aliases: ['mine'],
  execute(message, args) {
    let testMode = false;
    if ((args[0] || '').toLowerCase() === 'test') {
      if (message.author.id !== config.ownerId) return;
      testMode = true;
      args.shift();
    }

    let amount;
    if ((args[0] || '').toLowerCase() === 'all' && !testMode) { const u = db.ensureUser(message.author.id); amount = Math.min(u.balance, db.getMaxBet(message.author.id)); if (amount <= 0) return message.channel.send('you have no money'); }
    else { amount = parseAmount(args[0]); if (isNaN(amount) || amount <= 0) amount = testMode ? 1000 : undefined; if (amount === undefined) return message.channel.send('bet an amount or use `all`'); }

    const user = db.ensureUser(message.author.id);
    if (!testMode && user.balance < amount) return message.channel.send('not enough money');
    if (activeGames.has(message.author.id)) return message.channel.send('you already have an active mines game');

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
    const game = { bombs: createGrid(bombCount), bombCount, revealed: new Set(), bet: amount, active: true, lastSafe: -1, hitBomb: undefined, testMode, lucky, hasCustomMines };
    activeGames.set(message.author.id, game);

    message.channel.send({
      components: [buildContainer(game)],
      flags: MessageFlags.IsComponentsV2,
    }).then(msg => {
      const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
      col.on('collect', async (i) => {
        if (!game.active) { await i.deferUpdate().catch(() => {}); return; }
        if (i.customId === 'm_cash') {
          game.active = false; activeGames.delete(message.author.id);
          const p = Math.floor(game.bet * mult(game.revealed.size, game.bombCount, game.lucky));
          const paid = game.testMode ? (p - game.bet) : db.payWin(message.author.id, p - game.bet, game.bet);
          const total = game.bet + paid;
          return i.update({ components: [new ContainerBuilder().setAccentColor(0x57f287).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${game.testMode ? '🧪' : '💣'} Mines  |  Cashed Out${game.testMode ? ' [TEST]' : ''}\n\n**${total.toLocaleString()}** ${config.currency} (+**${paid}**)`))], flags: MessageFlags.IsComponentsV2 });
        }
        const idx = parseInt(i.customId.split('_')[1]);
        if (game.revealed.has(idx)) { await i.deferUpdate().catch(() => {}); return; }
        if (game.bombs[idx]) {
          game.active = false; game.hitBomb = idx; activeGames.delete(message.author.id);
          for (let j = 0; j < ROWS * COLS; j++) game.revealed.add(j);
          return i.update({ components: [new ContainerBuilder().setAccentColor(0xed4245).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${game.testMode ? '🧪' : '💥'} Mines  |  Touched a mine!${game.testMode ? ' [TEST]' : ''}\n\nLost **${game.bet.toLocaleString()}** ${config.currency}${game.testMode ? ' (no money lost)' : ''}`)).addActionRowComponents(...buildButtons(game))], flags: MessageFlags.IsComponentsV2 });
        }
        game.revealed.add(idx); game.lastSafe = idx;
        const rc = game.revealed.size;
        if (rc >= ROWS * COLS - game.bombCount) {
          game.active = false; activeGames.delete(message.author.id);
          const p = Math.floor(game.bet * mult(rc, game.bombCount, game.lucky));
          const paid = game.testMode ? (p - game.bet) : db.payWin(message.author.id, p - game.bet, game.bet);
          const total = game.bet + paid;
          for (let j = 0; j < ROWS * COLS; j++) game.revealed.add(j);
          return i.update({ components: [new ContainerBuilder().setAccentColor(0x57f287).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${game.testMode ? '🧪' : '💣'} Mines  |  All Cleared!${game.testMode ? ' [TEST]' : ''}\n\n**${total.toLocaleString()}** ${config.currency} (+**${paid}**)${game.testMode ? ' (no money gained)' : ''}`)).addActionRowComponents(...buildButtons(game))], flags: MessageFlags.IsComponentsV2 });
        }
        i.update({ components: [buildContainer(game)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
      });
      col.on('end', () => {
        if (game.active) { game.active = false; activeGames.delete(message.author.id); msg.edit({ components: [] }).catch(() => {}); }
      });
    });
  },
};
