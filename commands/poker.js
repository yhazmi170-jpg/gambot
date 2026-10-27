const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

let customCardEmojis = {};
try {
  customCardEmojis = require('../utils/card_emojis.json');
} catch (_) {}

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_RANK = Object.fromEntries(VALUES.map((v, i) => [v, i + 2]));
const SUIT_EMOJI = { '♠': '♠️', '♥': '♥️', '♦': '♦️', '♣': '♣️' };
const SUIT_CODE = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
const RANK_NAMES = {
  14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: '10s',
  9: '9s', 8: '8s', 7: '7s', 6: '6s', 5: '5s', 4: '4s', 3: '3s', 2: '2s'
};

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

function cardLabel(c) {
  const key = `${c.value === '10' ? '10' : c.value.toLowerCase()}${SUIT_CODE[c.suit]}`;
  if (customCardEmojis[key]) return customCardEmojis[key];
  if (config.cardEmojis && (config.cardEmojis[key] || config.cardEmojis[key.toUpperCase()])) {
    return config.cardEmojis[key] || config.cardEmojis[key.toUpperCase()];
  }
  return `**${c.value}**${SUIT_EMOJI[c.suit]}`;
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

function describeHand(cards) {
  const result = evaluateHand(cards);
  if (result.rank > 0) return `${result.name} (${result.payout}×)`;

  const values = cards.map(c => VALUE_RANK[c.value]).sort((a, b) => b - a);
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (groups[0] && groups[0][1] === 2) {
    const pairVal = groups[0][0];
    return `Pair of ${RANK_NAMES[pairVal] || pairVal} (Low Pair)`;
  }
  const maxVal = Math.max(...values);
  const highName = Object.keys(VALUE_RANK).find(k => VALUE_RANK[k] === maxVal) || 'None';
  return `High Card (${highName})`;
}

module.exports = {
  name: 'poker',
  description: 'video poker (VIP perk) — hold/draw for payouts',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  aliases: ['videopoker'],
  execute(message, args) {
    const uid = message.author.id;
    const user = db.ensureUser(uid);
    if (!db.hasPerk(uid, 'vip_games') && !config.isOwner(uid))
      return message.channel.send({ embeds: [error('this game requires the **VIP game modes access** perk — buy it in the shop')] });

    const { amount, error: betError } = db.parseBet(uid, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const deck = createDeck();
    let cards = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
    let held = [false, false, false, false, false];

    function buildPokerEmbed(isFinal = false, result = null, outcomeLine = '', finalColor = 0x5865f2) {
      const cardRow = cards.map(c => cardLabel(c)).join(' ');
      const statusRow = cards.map((_, i) => {
        if (isFinal) {
          return held[i] ? '`[ HELD ]`' : '`[ DRAWN ]`';
        }
        return held[i] ? '`[🔒HELD]`' : `\`[  #${i + 1}  ]\``;
      }).join(' ');

      const descLines = [
        `🪙 **Bet:** **${amount.toLocaleString()}** ${config.currency}`,
        '',
        cardRow,
        statusRow,
        '',
      ];

      if (isFinal) {
        descLines.push(`🏆 **Final Hand:** **${result.name}**`);
        descLines.push(outcomeLine);
      } else {
        descLines.push(`🎯 **Current Hand:** **${describeHand(cards)}**`);
        descLines.push('*Tap card buttons below to HOLD, then click DRAW to replace unheld cards.*');
      }

      const e = new EmbedBuilder()
        .setColor(isFinal ? finalColor : 0x5865f2)
        .setAuthor({
          name: `${message.author.username}'s Video Poker`,
          iconURL: message.author.displayAvatarURL ? message.author.displayAvatarURL({ dynamic: true }) : undefined,
        })
        .setTitle(isFinal ? '🃏 Video Poker — Round Over' : '🃏 Video Poker')
        .setDescription(descLines.join('\n'))
        .addFields({
          name: '📊 Paytable',
          value:
            '`800×` Royal Flush  • `50×` Straight Flush • `25×` 4 of a Kind\n' +
            '`  9×` Full House   • ` 6×` Flush          • `  4×` Straight\n' +
            '`  3×` 3 of a Kind  • ` 2×` Two Pair       • `  1×` Jacks or Better',
        });

      if (!isFinal) {
        e.setFooter({ text: 'Hold cards you want to keep • Pair of Jacks or better wins' });
      }

      return e;
    }

    function makeButtons(disabled = false) {
      const heldCount = held.filter(Boolean).length;
      const drawLabel = heldCount === 5
        ? 'Keep All Cards'
        : (heldCount === 0 ? 'Draw (Replace All 5)' : `Draw (${5 - heldCount} New Cards)`);

      const cardButtons = cards.map((c, i) => {
        const isHeld = held[i];
        return new ButtonBuilder()
          .setCustomId(`ph_${i}`)
          .setLabel(`${i + 1} · ${c.value}`)
          .setEmoji(isHeld ? '🔒' : SUIT_EMOJI[c.suit])
          .setStyle(isHeld ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(disabled);
      });

      const drawButton = new ButtonBuilder()
        .setCustomId('pd')
        .setLabel(drawLabel)
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

      return [
        new ActionRowBuilder().addComponents(cardButtons),
        new ActionRowBuilder().addComponents(drawButton),
      ];
    }

    message.channel.send({
      embeds: [buildPokerEmbed()],
      components: makeButtons(),
    }).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
      const filter = i => i.user.id === uid && (i.customId === 'pd' || i.customId.startsWith('ph_'));
      const col = msg.createMessageComponentCollector({ filter, time: 60000 });

      function finish(collected) {
        for (let i = 0; i < 5; i++) if (!held[i]) cards[i] = deck.pop();
        const result = evaluateHand(cards);
        let line;
        let color;
        if (result.payout > 1) {
          const profit = amount * result.payout - amount;
          const paid = db.payWin(uid, profit);
          line = `**${result.name}!** Won **${(amount + paid).toLocaleString()}** ${config.currency} (+**${paid.toLocaleString()}**)`;
          color = 0x57f287;
        } else if (result.payout === 1) {
          line = `**Jacks or Better!** — push (bet returned)`;
          color = 0xfee75c;
        } else {
          db.addBalance(uid, -amount); db.addGambled(uid, amount);
          const refund = db.getInsuranceRefund(uid, amount);
          if (refund > 0) db.addBalance(uid, refund);
          line = `**${result.name}** — lost **${amount.toLocaleString()}** ${config.currency}${refund > 0 ? ` (refund **${refund.toLocaleString()}**)` : ''}`;
          color = 0xed4245;
        }
        msg.edit({
          embeds: [buildPokerEmbed(true, result, line, color)],
          components: [],
        }).catch(() => {});
      }

      col.on('collect', async (interaction) => {
        if (interaction.customId === 'pd') { finish(true); col.stop(); return; }
        const idx = parseInt(interaction.customId.split('_')[1]);
        held[idx] = !held[idx];
        await interaction.update({ embeds: [buildPokerEmbed()], components: makeButtons() }).catch(() => {});
      });

      col.on('end', async (collected) => {
        if (!collected.size) finish(false);
      });
    });
  },
};
