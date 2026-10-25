const db = require('../db');
const config = require('../config');
const { error } = require('../utils/embed');
const cardEmojis = require('../utils/card_emojis.json');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const activeGames = new Map();

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'];
const SUITS = ['c', 'd', 'h', 's'];
const VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'j': 11, 'q': 12, 'k': 13, 'a': 14,
};
const DISPLAY_NAMES = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'j': 'J', 'q': 'Q', 'k': 'K', 'a': 'A',
};

function randomCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return {
    rank,
    suit,
    val: VALUES[rank],
    name: DISPLAY_NAMES[rank],
    emoji: cardEmojis[`${rank}${suit}`] || '🂠',
  };
}

function getGains(val) {
  const higherCount = 14 - val;
  const lowerCount = val - 2;

  // Higher gain: fewer higher ranks left = bigger gain
  const pctH = higherCount > 0 ? Math.max(5, Math.round(((13 - higherCount) / 13) * 66)) : 0;
  // Lower gain: fewer lower ranks left = bigger gain
  const pctL = lowerCount > 0 ? Math.max(5, Math.round(((13 - lowerCount) / 13) * 66)) : 0;
  // Same gain: exactly 100%
  const pctS = 100;

  return { pctH, pctL, pctS };
}

function buildContainer(game) {
  let color = 0x5865f2; // Blurple
  let header = '';
  let body = '';
  const cardback = cardEmojis['cardback'] || '🂠';

  const { pctH, pctL, pctS } = getGains(game.currentCard.val);

  if (game.outcome === 'cashout') {
    color = 0x57f287; // Green
    header =
      `### 💰 <@${game.userId}> cashed out!\n` +
      `-# **Bet**: \`${game.bet.toLocaleString()}\`    **Streak**: \`${game.streak}\`    **Winnings**: \`${game.total.toLocaleString()}\` \`(${game.mult.toFixed(2)}x)\``;
    body = `${game.currentCard.emoji}\n\n**Cashed out successfully!**`;
  } else if (game.outcome === 'lost') {
    color = 0xed4245; // Red
    const refundStr = game.refund > 0 ? `\n-# 🛡️ **Insurance Refund**: \`${game.refund.toLocaleString()}\`` : '';
    header =
      `### 💥 <@${game.userId}> guessed wrong!\n` +
      `-# **Bet**: \`${game.bet.toLocaleString()}\`    **Streak**: \`${game.streak}\`    **Lost**: \`${game.bet.toLocaleString()}\`${refundStr}`;
    body = `${game.prevCard.emoji} ▶ ${game.currentCard.emoji}\n\nThe next card was **${game.currentCard.name}**!`;
  } else {
    // Active game
    const actionLabel = game.streak > 0 ? 'guessed correctly!' : 'started a HighLow game.';
    header =
      `### 🃏 <@${game.userId}> ${actionLabel}\n` +
      `-# **Bet**: \`${game.bet.toLocaleString()}\`    **Streak**: \`${game.streak}\`    **Cash Out**: \`${game.cashOut.toLocaleString()}\` \`(${game.mult.toFixed(2)}x)\``;
    body =
      `${game.currentCard.emoji} ▶ ${cardback}\n\n` +
      `Is the next card higher, lower, or the same value?\nCurrent Card: ${game.currentCard.name}`;
  }

  const container = new ContainerBuilder().setAccentColor(color);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(header)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(1)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(body)
  );

  const disabled = !game.active;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hl_higher_${game.id}`)
      .setLabel(`Higher (+${pctH})`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || pctH === 0),
    new ButtonBuilder()
      .setCustomId(`hl_lower_${game.id}`)
      .setLabel(`Lower (+${pctL})`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || pctL === 0),
    new ButtonBuilder()
      .setCustomId(`hl_same_${game.id}`)
      .setLabel(`Same (+${pctS})`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hl_cash_${game.id}`)
      .setLabel('Cash Out')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled || game.streak === 0)
  );

  container.addActionRowComponents(row1, row2);

  return { components: [container] };
}

module.exports = {
  name: 'highlow',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'guess whether next card is higher, lower, or same',
  aliases: ['hl'],
  async execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });
    if (activeGames.has(message.author.id)) {
      return message.channel.send({ embeds: [error('you already have an active HighLow game')] });
    }

    db.addBalance(message.author.id, -amount);
    db.addGambled(message.author.id, amount);

    const game = {
      id: Math.random().toString(36).slice(2, 8),
      userId: message.author.id,
      bet: amount,
      streak: 0,
      mult: 1.0,
      cashOut: 0,
      currentCard: randomCard(),
      prevCard: null,
      active: true,
      outcome: null,
      refund: 0,
      total: 0,
    };

    activeGames.set(message.author.id, game);

    const msg = await message.channel.send(buildContainer(game)).catch(() => null);
    if (!msg) {
      activeGames.delete(message.author.id);
      db.addBalance(message.author.id, amount);
      return;
    }

    if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
    setTimeout(() => {
      if (global._interactionOwners) global._interactionOwners.delete(msg.id);
    }, 300000);

    const col = msg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300000,
    });

    col.on('collect', async (i) => {
      if (!game.active) {
        return i.deferUpdate().catch(() => {});
      }

      if (i.customId.startsWith('hl_cash_')) {
        if (game.streak === 0) return i.deferUpdate().catch(() => {});
        game.active = false;
        activeGames.delete(message.author.id);

        const profit = game.cashOut - game.bet;
        const paid = db.payWin(message.author.id, profit, game.bet);
        game.total = game.bet + paid;
        game.outcome = 'cashout';

        return i.update(buildContainer(game)).catch(() => {});
      }

      const { pctH, pctL, pctS } = getGains(game.currentCard.val);
      const next = randomCard();
      let won = false;
      let gainPct = 0;

      if (i.customId.startsWith('hl_higher_')) {
        won = next.val > game.currentCard.val;
        gainPct = pctH;
      } else if (i.customId.startsWith('hl_lower_')) {
        won = next.val < game.currentCard.val;
        gainPct = pctL;
      } else if (i.customId.startsWith('hl_same_')) {
        won = next.val === game.currentCard.val;
        gainPct = pctS;
      }

      game.prevCard = game.currentCard;
      game.currentCard = next;

      if (won) {
        game.streak++;
        game.mult = game.mult * (1 + gainPct / 100);
        game.cashOut = Math.floor(game.bet * game.mult);
        return i.update(buildContainer(game)).catch(() => {});
      } else {
        game.active = false;
        activeGames.delete(message.author.id);
        game.outcome = 'lost';
        const refund = db.getInsuranceRefund(message.author.id, game.bet);
        if (refund > 0) {
          db.addBalance(message.author.id, refund);
          game.refund = refund;
        }
        return i.update(buildContainer(game)).catch(() => {});
      }
    });

    col.on('end', () => {
      if (game.active) {
        game.active = false;
        activeGames.delete(message.author.id);
        if (game.streak > 0 && game.cashOut > 0) {
          const profit = game.cashOut - game.bet;
          const paid = db.payWin(message.author.id, profit, game.bet);
          game.total = game.bet + paid;
          game.outcome = 'cashout';
        } else {
          game.outcome = 'lost';
        }
        msg.edit(buildContainer(game)).catch(() => {});
      }
    });
  },
};
