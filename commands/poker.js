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

const SUIT_BASE = { '♠': 0x1F0A0, '♥': 0x1F0B0, '♦': 0x1F0C0, '♣': 0x1F0D0 };
const VAL_OFF = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
function cardEmoji(c) { return String.fromCodePoint(SUIT_BASE[c.suit] + VAL_OFF[c.value]); }

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

module.exports = {
  name: 'poker',
  description: 'video poker — try to make the best 5-card hand',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  aliases: ['videopoker'],
  execute(message, args) {
    const uid = message.author.id;
    const user = db.ensureUser(uid);
    if (!db.hasPerk(uid, 'vip_games') && uid !== config.ownerId)
      return message.channel.send({ embeds: [error('this game requires the **VIP game modes access** perk — buy it in the shop')] });

    let amount;
    if ((args[0] || '').toLowerCase() === 'all') {
      amount = Math.min(user.balance, db.getMaxBet(uid));
      if (amount <= 0) return message.channel.send({ embeds: [error('you have no money')] });
    } else {
      amount = parseAmount(args[0]);
      if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('bet an amount or use `all`')] });
    }
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const deck = createDeck();
    let cards = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
    let held = [false, false, false, false, false];

    function makeField() {
      const cardsLine = cards.map((c, i) => {
        return `${cardEmoji(c)}${held[i] ? ' `HOLD`' : ''}`;
      }).join('  ');
      return `${cardsLine}\n**Bet:** ${amount.toLocaleString()} ${config.currency}\n\n800× 50× 25× 9× 6× 4× 3× 2× 1×`;
    }

    const btnStyle = (i) => held[i] ? ButtonStyle.Primary : ButtonStyle.Secondary;
    const btnLabel = (i) => `${i + 1}`;
    function makeButtons() {
      return [
        new ActionRowBuilder().addComponents(
          cards.map((_, i) => new ButtonBuilder()
            .setCustomId(`ph_${i}`).setLabel(btnLabel(i)).setStyle(btnStyle(i)))
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pd').setLabel('DRAW').setStyle(ButtonStyle.Success)
        ),
      ];
    }

    const color = 0x2b2d31;
    message.channel.send({
      embeds: [embed('🃏 Video Poker', [['', makeField()]], color)],
      components: makeButtons(),
    }).then(msg => {
      const filter = i => i.user.id === uid && (i.customId === 'pd' || i.customId.startsWith('ph_'));
      const col = msg.createMessageComponentCollector({ filter, time: 60000 });

      function finish(collected) {
        for (let i = 0; i < 5; i++) if (!held[i]) cards[i] = deck.pop();
        const result = evaluateHand(cards);
        let line;
        if (result.payout > 1) {
          const profit = amount * result.payout - amount;
          db.addBalance(uid, profit); db.addWon(uid, profit);
          line = `**${result.name}!** 🎉 Won **${(amount * result.payout).toLocaleString()}** ${config.currency} (+**${profit.toLocaleString()}**)`;
        } else if (result.payout === 1) {
          line = `**Jacks or Better!** — push (bet returned)`;
        } else {
          db.addBalance(uid, -amount); db.addGambled(uid, amount);
          line = `**${result.name}** — lost **${amount.toLocaleString()}** ${config.currency}`;
        }
        msg.edit({
          embeds: [embed('🃏 Video Poker', [['', makeField()], ['Result', line]], result.payout >= 1 ? 0x57f287 : 0xed4245)],
          components: [],
        }).catch(() => {});
      }

      col.on('collect', async (interaction) => {
        if (interaction.customId === 'pd') { finish(true); col.stop(); return; }
        const idx = parseInt(interaction.customId.split('_')[1]);
        held[idx] = !held[idx];
        await interaction.update({ embeds: [embed('🃏 Video Poker', [['', makeField()]], color)], components: makeButtons() });
      });

      col.on('end', async (collected) => {
        if (!collected.size) finish(false);
      });
    });
  },
};
