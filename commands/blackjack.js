const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

function board({ name, player, dealer, reveal, bet, result }) {
  const lines = [];
  if (bet != null) lines.push(`**${name}**, you bet **${bet.toLocaleString()}** to play blackjack`, '');

  if (reveal) {
    lines.push(`**Dealer** [${handValue(dealer)}]`, formatCards(dealer));
  } else {
    const up = String(cardValue(dealer[0]));
    lines.push(`**Dealer** [${up}+?]`, `${cardLabel(dealer[0])} ${cardBack()}`);
  }

  lines.push('', `**${name}** [${handValue(player)}]`, formatCards(player));
  if (result) lines.push('', `**Result:** ${result}`);
  return lines.join('\n');
}

const activeGames = new Map();

function playLoop(msg, player, dealer, deck, bet, userId, name) {
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger),
  );

  msg.edit({
    content: board({ name, player, dealer, reveal: false, bet }),
    embeds: [],
    components: [buttons],
  }).then(() => {
    const filter = i => i.user.id === userId && (i.customId === 'bj_hit' || i.customId === 'bj_stand');
    const col = msg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    col.on('collect', async (interaction) => {
      if (interaction.customId === 'bj_hit') {
        player.push(deck.pop());
        const npv = handValue(player);
        if (npv > 21) {
          activeGames.delete(userId);
          db.addBalance(userId, -bet);
          db.addGambled(userId, bet);
          const refund = db.getInsuranceRefund(userId, bet);
          if (refund > 0) db.addBalance(userId, refund);
          while (handValue(dealer) < 17) dealer.push(deck.pop());
          await interaction.update({
            content: board({
              name, player, dealer, reveal: true, bet,
              result: `bust — lost **${bet.toLocaleString()}**${refund > 0 ? ` (refund **${refund}**)` : ''}`,
            }),
            embeds: [],
            components: [],
          });
          return;
        }
        await interaction.deferUpdate();
        playLoop(msg, player, dealer, deck, bet, userId, name);
      } else {
        activeGames.delete(userId);
        while (handValue(dealer) < 17) dealer.push(deck.pop());
        const dv = handValue(dealer);
        const pv2 = handValue(player);
        let result;
        if (dv > 21 || pv2 > dv) {
          const paid = db.payWin(userId, bet);
          result = `won **${(bet + paid).toLocaleString()}** (+**${paid.toLocaleString()}**)`;
        } else if (pv2 === dv) {
          result = `tie — **${bet.toLocaleString()}** returned`;
        } else {
          const refund = db.getInsuranceRefund(userId, bet);
          if (refund > 0) db.addBalance(userId, refund);
          db.addBalance(userId, -bet);
          db.addGambled(userId, bet);
          result = `lost **${bet.toLocaleString()}**${refund > 0 ? ` (refund **${refund}**)` : ''}`;
        }
        await interaction.update({
          content: board({ name, player, dealer, reveal: true, bet, result }),
          embeds: [],
          components: [],
        });
      }
    });

    col.on('end', async (collected) => {
      if (!collected.size) {
        activeGames.delete(userId);
        while (handValue(dealer) < 17) dealer.push(deck.pop());
        const dv = handValue(dealer);
        const pv2 = handValue(player);
        let result;
        if (dv > 21 || pv2 > dv) {
          const paid = db.payWin(userId, bet);
          result = `won **${(bet + paid).toLocaleString()}** (+**${paid.toLocaleString()}**) (timed out)`;
        } else if (pv2 === dv) {
          result = `tie — **${bet.toLocaleString()}** returned (timed out)`;
        } else {
          db.addBalance(userId, -bet);
          db.addGambled(userId, bet);
          result = `lost **${bet.toLocaleString()}** (timed out)`;
        }
        await msg.edit({
          content: board({ name, player, dealer, reveal: true, bet, result }),
          embeds: [],
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
    if (activeGames.has(message.author.id)) {
      const g = activeGames.get(message.author.id);
      const resuming = `🎲 ~ Resuming your active blackjack game!\n\n`;
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger),
      );
      return message.channel.send({
        content: resuming + board({ name: g.name, player: g.player, dealer: g.dealer, reveal: false, bet: g.bet }),
        components: [buttons],
      }).then(msg => {
        if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
        g.msg = msg;
        playLoop(msg, g.player, g.dealer, g.deck, g.bet, message.author.id, g.name);
      }).catch(() => {});
    }

    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const name = message.member?.displayName || message.author.username;
    
    const deck = createDeck();
    let player = [deck.pop(), deck.pop()];
    let dealer = [deck.pop(), deck.pop()];

    const pv = handValue(player);
    if (pv === 21) {
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      const dv = handValue(dealer);
      if (dv === 21) {
        return message.channel.send({
          content: board({
            name, player, dealer, reveal: true, bet: amount,
            result: 'tie — **' + amount.toLocaleString() + '** returned',
          }),
        });
      }
      const paid = db.payWin(message.author.id, amount);
      return message.channel.send({
        content: board({
          name, player, dealer, reveal: true, bet: amount,
          result: `blackjack! won **${(amount + paid).toLocaleString()}** (+**${paid.toLocaleString()}**)`,
        }),
      });
    }

    activeGames.set(message.author.id, { player, dealer, deck, bet: amount, name });

    const initialButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger),
    );
    message.channel.send({
      content: board({ name, player, dealer, reveal: false, bet: amount }),
      components: [initialButtons],
    }).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
      playLoop(msg, player, dealer, deck, amount, message.author.id, name);
    }).catch(() => {});
  },
};
