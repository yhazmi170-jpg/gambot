const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_RANK = Object.fromEntries(VALUES.map((v, i) => [v, i + 2]));

function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const value of VALUES)
      deck.push({ suit, value });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function formatCards(cards) {
  return cards.map(c => `\`${c.value}${c.suit}\``).join(' ');
}

function evaluateHand(cards) {
  const values = cards.map(c => VALUE_RANK[c.value]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) { isStraight = true; straightHigh = unique[0]; }
    else if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      isStraight = true; straightHigh = 5;
    }
  }

  const isRoyal = isStraight && isFlush && straightHigh === 14;

  if (isRoyal) return { rank: 9, name: 'Royal Flush', payout: 800 };
  if (isStraight && isFlush) return { rank: 8, name: 'Straight Flush', payout: 50 };
  if (groups[0][1] === 4) return { rank: 7, name: 'Four of a Kind', payout: 25 };
  if (groups[0][1] === 3 && groups[1] && groups[1][1] === 2) return { rank: 6, name: 'Full House', payout: 9 };
  if (isFlush) return { rank: 5, name: 'Flush', payout: 6 };
  if (isStraight) return { rank: 4, name: 'Straight', payout: 4 };
  if (groups[0][1] === 3) return { rank: 3, name: 'Three of a Kind', payout: 3 };
  if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) return { rank: 2, name: 'Two Pair', payout: 2 };
  if (groups[0][1] === 2 && groups[0][0] >= VALUE_RANK['J']) return { rank: 1, name: 'Jacks or Better', payout: 1 };
  return { rank: 0, name: 'Nothing', payout: 0 };
}

function buildDisplay(cards, held, bet, result) {
  const lines = cards.map((c, i) => {
    const icon = held[i] ? '🔒' : '🔄';
    return `**${i + 1}:** ${formatCards([c])} ${icon}`;
  }).join('\n');
  const fields = [['Your Hand', lines], ['Bet', `${bet} ${config.currency}`]];
  if (result) fields.push(['Result', result]);
  return embed('🃏 Video Poker', fields, result ? (result.payout > 0 ? 0x57f287 : 0xed4245) : 0x2b2d31);
}

module.exports = {
  name: 'poker',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  aliases: ['videopoker'],
  execute(message, args) {
    const user = db.ensureUser(message.author.id);
    const hasVip = db.getPerkHolders('vip_games').includes(message.author.id);
    if (!hasVip && message.author.id !== config.ownerId)
      return message.channel.send({ embeds: [error('this game requires the **VIP game modes access** perk from the shop')] });

    let amount;
    if ((args[0] || '').toLowerCase() === 'all') {
      amount = Math.min(user.balance, db.getMaxBet(message.author.id));
      if (amount <= 0) return message.channel.send({ embeds: [error('you have no money')] });
    } else {
      amount = parseAmount(args[0]);
      if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('bet an amount or use `all`')] });
    }

    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const deck = createDeck();
    let cards = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
    let held = [false, false, false, false, false];

    const buttons = cards.map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`poker_hold_${i}`)
        .setLabel(`${i + 1}`)
        .setStyle(ButtonStyle.Secondary)
    );
    const drawBtn = new ButtonBuilder()
      .setCustomId('poker_draw')
      .setLabel('DRAW')
      .setStyle(ButtonStyle.Success);

    const row1 = new ActionRowBuilder().addComponents(...buttons);
    const row2 = new ActionRowBuilder().addComponents(drawBtn);

    message.channel.send({
      embeds: [buildDisplay(cards, held, amount, null)],
      components: [row1, row2],
    }).then(msg => {
      function updateButtons() {
        const newButtons = cards.map((_, i) =>
          new ButtonBuilder()
            .setCustomId(`poker_hold_${i}`)
            .setLabel(`${i + 1}${held[i] ? ' 🔒' : ''}`)
            .setStyle(held[i] ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );
        return [
          new ActionRowBuilder().addComponents(...newButtons),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('poker_draw')
              .setLabel('DRAW')
              .setStyle(ButtonStyle.Success)
          ),
        ];
      }

      const filter = i => i.user.id === message.author.id && (i.customId === 'poker_draw' || i.customId.startsWith('poker_hold_'));
      const col = msg.createMessageComponentCollector({ filter, time: 60000 });

      col.on('collect', async (interaction) => {
        if (interaction.customId.startsWith('poker_hold_')) {
          const idx = parseInt(interaction.customId.split('_')[2]);
          held[idx] = !held[idx];
          const newComponents = updateButtons();
          await interaction.update({ embeds: [buildDisplay(cards, held, amount, null)], components: newComponents });
        } else if (interaction.customId === 'poker_draw') {
          for (let i = 0; i < 5; i++) {
            if (!held[i]) cards[i] = deck.pop();
          }
          const result = evaluateHand(cards);
          let resultStr;
          let winnings = 0;

          if (result.payout > 0) {
            winnings = amount * result.payout;
            if (result.payout === 1) {
              resultStr = `**Jacks or Better!** — push (**${amount}** ${config.currency} returned)`;
            } else {
              const profit = winnings - amount;
              db.addBalance(message.author.id, profit);
              db.addWon(message.author.id, profit);
              resultStr = `**${result.name}!** — won **${winnings}** ${config.currency} (+**${profit}**)`;
            }
          } else {
            db.addBalance(message.author.id, -amount);
            db.addGambled(message.author.id, amount);
            resultStr = `**Nothing** — lost **${amount}** ${config.currency}`;
          }

          await interaction.update({
            embeds: [buildDisplay(cards, held, amount, resultStr)],
            components: [],
          });
          col.stop();
        }
      });

      col.on('end', async (collected) => {
        if (!collected.size || !collected.some(i => i.customId === 'poker_draw')) {
          for (let i = 0; i < 5; i++) {
            if (!held[i]) cards[i] = deck.pop();
          }
          const result = evaluateHand(cards);
          let resultStr;
          if (result.payout > 0) {
            if (result.payout === 1) {
              resultStr = `**Jacks or Better!** — push (**${amount}** ${config.currency} returned)`;
            } else {
              const profit = amount * result.payout - amount;
              db.addBalance(message.author.id, profit);
              db.addWon(message.author.id, profit);
              resultStr = `**${result.name}!** — won **${amount * result.payout}** ${config.currency} (+**${profit}**)`;
            }
          } else {
            db.addBalance(message.author.id, -amount);
            db.addGambled(message.author.id, amount);
            resultStr = `**Nothing** — lost **${amount}** ${config.currency}`;
          }
          await msg.edit({ embeds: [buildDisplay(cards, held, amount, resultStr)], components: [] }).catch(() => {});
        }
      });
    });
  },
};
