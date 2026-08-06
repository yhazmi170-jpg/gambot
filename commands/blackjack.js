const db = require('../db');
const { error, parseAmount, getSponsored } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const CARDBACK = '🎴';
const SUIT_EMOJI = { '♠': '♠️', '♥': '♥️', '♦': '♦️', '♣': '♣️' };
const SUIT_CODE = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of suits)
    for (const value of values)
      deck.push({ suit, value });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}

function handValue(hand) {
  let val = hand.reduce((s, c) => s + cardValue(c), 0);
  let aces = hand.filter(c => c.value === 'A').length;
  while (val > 21 && aces > 0) { val -= 10; aces--; }
  return val;
}

/** Prefer custom server emojis from config.cardEmojis if set (owo-style :jh:), else Discord suits. */
function cardLabel(c) {
  const key = `${c.value === '10' ? '10' : c.value.toLowerCase()}${SUIT_CODE[c.suit]}`;
  const custom = config.cardEmojis && (config.cardEmojis[key] || config.cardEmojis[key.toUpperCase()]);
  if (custom) return custom;
  return `${c.value}${SUIT_EMOJI[c.suit]}`;
}

function formatCards(cards) {
  return cards.map(c => cardLabel(c)).join(' ');
}

function cardBack() {
  return (config.cardEmojis && config.cardEmojis.cardback) || CARDBACK;
}

function bjEmbed(description, color = 0x2b2d31) {
  const e = new EmbedBuilder().setColor(color).setDescription(description);
  const sponsored = getSponsored();
  if (sponsored) e.setFooter({ text: `Sponsored by @${sponsored}` });
  return e;
}

function board({ name, player, dealer, reveal, bet, result }) {
  const lines = [];
  if (bet != null) lines.push(`you bet **${bet.toLocaleString()}** to play blackjack`, '');

  if (reveal) {
    lines.push(`**Dealer** [${handValue(dealer)}]`, formatCards(dealer));
  } else {
    const up = String(cardValue(dealer[0]));
    lines.push(`**Dealer** [${up}+?]`, `${cardLabel(dealer[0])} ${cardBack()}`);
  }

  lines.push('', `**${name}** [${handValue(player)}]`, formatCards(player));
  if (result) lines.push('', result);
  return lines.join('\n');
}

function playLoop(msg, player, dealer, deck, bet, userId, name) {
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger),
  );

  msg.edit({
    embeds: [bjEmbed(board({ name, player, dealer, reveal: false, bet }))],
    components: [buttons],
  }).then(() => {
    const filter = i => i.user.id === userId && (i.customId === 'bj_hit' || i.customId === 'bj_stand');
    const col = msg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    col.on('collect', async (interaction) => {
      if (interaction.customId === 'bj_hit') {
        player.push(deck.pop());
        const npv = handValue(player);
        if (npv > 21) {
          db.addBalance(userId, -bet);
          db.addGambled(userId, bet);
          const refund = db.getInsuranceRefund(userId, bet);
          if (refund > 0) db.addBalance(userId, refund);
          while (handValue(dealer) < 17) dealer.push(deck.pop());
          await interaction.update({
            embeds: [bjEmbed(board({
              name, player, dealer, reveal: true, bet,
              result: `bust — lost **${bet.toLocaleString()}**${refund > 0 ? ` (refund **${refund}**)` : ''}`,
            }), 0xed4245)],
            components: [],
          });
          return;
        }
        await interaction.deferUpdate();
        playLoop(msg, player, dealer, deck, bet, userId, name);
      } else {
        while (handValue(dealer) < 17) dealer.push(deck.pop());
        const dv = handValue(dealer);
        const pv2 = handValue(player);
        const isLucky = db.ensureUser(userId).lucky;
        let result, color;
        if (dv > 21 || pv2 > dv) {
          const paid = db.payWin(userId, bet * (isLucky ? 3 : 1));
          result = `won **${(bet + paid).toLocaleString()}** (+**${paid.toLocaleString()}**)`;
          color = 0x57f287;
        } else if (pv2 === dv) {
          result = `tie — **${bet.toLocaleString()}** returned`;
          color = 0xfee75c;
        } else {
          const refund = db.getInsuranceRefund(userId, bet);
          if (refund > 0) db.addBalance(userId, refund);
          db.addBalance(userId, -bet);
          db.addGambled(userId, bet);
          result = `lost **${bet.toLocaleString()}**${refund > 0 ? ` (refund **${refund}**)` : ''}`;
          color = 0xed4245;
        }
        await interaction.update({
          embeds: [bjEmbed(board({ name, player, dealer, reveal: true, bet, result }), color)],
          components: [],
        });
      }
    });

    col.on('end', async (collected) => {
      if (!collected.size) {
        while (handValue(dealer) < 17) dealer.push(deck.pop());
        const dv = handValue(dealer);
        const pv2 = handValue(player);
        const isLucky = db.ensureUser(userId).lucky;
        let result, color;
        if (dv > 21 || pv2 > dv) {
          const paid = db.payWin(userId, bet * (isLucky ? 3 : 1));
          result = `won **${(bet + paid).toLocaleString()}** (+**${paid.toLocaleString()}**) (timed out)`;
          color = 0x57f287;
        } else if (pv2 === dv) {
          result = `tie — **${bet.toLocaleString()}** returned (timed out)`;
          color = 0xfee75c;
        } else {
          db.addBalance(userId, -bet);
          db.addGambled(userId, bet);
          result = `lost **${bet.toLocaleString()}** (timed out)`;
          color = 0xed4245;
        }
        await msg.edit({
          embeds: [bjEmbed(board({ name, player, dealer, reveal: true, bet, result }), color)],
          components: [],
        }).catch(() => {});
      }
    });
  });
}

module.exports = {
  name: 'blackjack',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'blackjack — beat the dealer to 21',
  aliases: ['bj', 'twentyone'],
  execute(message, args) {
    let amount;
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

    const name = message.member?.displayName || message.author.username;
    const lucky = user.lucky;
    const deck = createDeck();
    let player = [deck.pop(), deck.pop()];
    let dealer = [deck.pop(), deck.pop()];
    if (lucky) {
      while (handValue(player) < 21) player.push(deck.pop());
      if (handValue(player) > 21) player = [deck.pop(), deck.pop()];
    }

    const pv = handValue(player);
    if (pv === 21) {
      const paid = db.payWin(message.author.id, amount * (lucky ? 3 : 1));
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      return message.channel.send({
        embeds: [bjEmbed(board({
          name, player, dealer, reveal: true, bet: amount,
          result: `blackjack! won **${(amount + paid).toLocaleString()}** (+**${paid.toLocaleString()}**)`,
        }), 0x57f287)],
      });
    }

    const initialButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    message.channel.send({
      embeds: [bjEmbed(board({ name, player, dealer, reveal: false, bet: amount }))],
      components: [initialButtons],
    }).then(msg => {
      playLoop(msg, player, dealer, deck, amount, message.author.id, name);
    }).catch(() => {});
  },
};
