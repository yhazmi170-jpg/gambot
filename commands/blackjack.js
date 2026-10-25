const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

let customCardEmojis = {};
try {
  customCardEmojis = require('../utils/card_emojis.json');
} catch (_) {}

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

function cardLabel(c) {
  const key = `${c.value === '10' ? '10' : c.value.toLowerCase()}${SUIT_CODE[c.suit]}`;
  if (customCardEmojis[key]) return customCardEmojis[key];
  if (config.cardEmojis && (config.cardEmojis[key] || config.cardEmojis[key.toUpperCase()])) {
    return config.cardEmojis[key] || config.cardEmojis[key.toUpperCase()];
  }
  return `${c.value}${SUIT_EMOJI[c.suit]}`;
}

function formatCards(cards) {
  return cards.map(c => cardLabel(c)).join(' ');
}

function cardBack() {
  if (customCardEmojis.cardback) return customCardEmojis.cardback;
  if (config.cardEmojis && config.cardEmojis.cardback) return config.cardEmojis.cardback;
  return CARDBACK;
}

function buildEmbed({ name, avatarURL, player, dealer, reveal, bet, result, statusText, color = 8240363 }) {
  const embed = new EmbedBuilder().setColor(color);

  if (bet != null) {
    const authorOpts = {
      name: `${name}, you bet ${bet.toLocaleString()} to play blackjack`,
    };
    if (avatarURL) authorOpts.iconURL = avatarURL;
    embed.setAuthor(authorOpts);
  }

  let dealerVal, dealerCards;
  if (reveal) {
    dealerVal = handValue(dealer);
    dealerCards = formatCards(dealer);
  } else {
    dealerVal = `${cardValue(dealer[0])}+?`;
    dealerCards = `${cardLabel(dealer[0])} ${cardBack()}`;
  }

  const playerVal = handValue(player);
  const playerCards = formatCards(player);

  embed.addFields(
    { name: `Dealer \`[${dealerVal}]\``, value: dealerCards, inline: true },
    { name: `${name} \`[${playerVal}]\``, value: playerCards, inline: true },
  );

  const footer = result || statusText;
  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}

const activeGames = new Map();

function attachCollector(msg, player, dealer, deck, bet, userId, name, avatarURL) {
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
        return interaction.update({
          embeds: [buildEmbed({
            name, avatarURL, player, dealer, reveal: true, bet,
            result: `bust — lost ${bet.toLocaleString()}${refund > 0 ? ` (refund ${refund.toLocaleString()})` : ''}`,
            color: 0xed4245,
          })],
          components: [],
        });
      }
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setEmoji('👊').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setEmoji('🛑').setStyle(ButtonStyle.Danger),
      );
      await interaction.update({
        embeds: [buildEmbed({ name, avatarURL, player, dealer, reveal: false, bet, color: 8240363 })],
        components: [buttons],
      });
      attachCollector(msg, player, dealer, deck, bet, userId, name, avatarURL);
    } else {
      activeGames.delete(userId);
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      const dv = handValue(dealer);
      const pv2 = handValue(player);
      let result, color;
      if (dv > 21 || pv2 > dv) {
        const paid = db.payWin(userId, bet);
        result = `won ${(bet + paid).toLocaleString()} (+${paid.toLocaleString()})`;
        color = 0x57f287;
      } else if (pv2 === dv) {
        result = `tie — ${bet.toLocaleString()} returned`;
        color = 0xfee75c;
      } else {
        const refund = db.getInsuranceRefund(userId, bet);
        if (refund > 0) db.addBalance(userId, refund);
        db.addBalance(userId, -bet);
        db.addGambled(userId, bet);
        result = `lost ${bet.toLocaleString()}${refund > 0 ? ` (refund ${refund.toLocaleString()})` : ''}`;
        color = 0xed4245;
      }
      await interaction.update({
        embeds: [buildEmbed({ name, avatarURL, player, dealer, reveal: true, bet, result, color })],
        components: [],
      });
    }
  });

  col.on('end', async (collected) => {
    if (!collected.size && activeGames.has(userId)) {
      activeGames.delete(userId);
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      const dv = handValue(dealer);
      const pv2 = handValue(player);
      let result, color;
      if (dv > 21 || pv2 > dv) {
        const paid = db.payWin(userId, bet);
        result = `won ${(bet + paid).toLocaleString()} (+${paid.toLocaleString()}) (timed out)`;
        color = 0x57f287;
      } else if (pv2 === dv) {
        result = `tie — ${bet.toLocaleString()} returned (timed out)`;
        color = 0xfee75c;
      } else {
        db.addBalance(userId, -bet);
        db.addGambled(userId, bet);
        result = `lost ${bet.toLocaleString()} (timed out)`;
        color = 0xed4245;
      }
      await msg.edit({
        embeds: [buildEmbed({ name, avatarURL, player, dealer, reveal: true, bet, result, color })],
        components: [],
      }).catch(() => {});
    }
  });
}

module.exports = {
  name: 'blackjack',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'blackjack — beat the dealer to 21',
  aliases: ['bj', 'twentyone'],
  execute(message, args) {
    const name = message.author.username || 'Player';
    const avatarURL = message.author.displayAvatarURL ? message.author.displayAvatarURL({ extension: 'png', size: 128 }) : null;

    if (activeGames.has(message.author.id)) {
      const g = activeGames.get(message.author.id);
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setEmoji('👊').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setEmoji('🛑').setStyle(ButtonStyle.Danger),
      );
      return message.channel.send({
        embeds: [buildEmbed({
          name: g.name,
          avatarURL: g.avatarURL,
          player: g.player,
          dealer: g.dealer,
          reveal: false,
          bet: g.bet,
          statusText: '🎲 ~ resuming previous game',
          color: 8240363,
        })],
        components: [buttons],
      }).then(msg => {
        if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
        g.msg = msg;
        attachCollector(msg, g.player, g.dealer, g.deck, g.bet, message.author.id, g.name, g.avatarURL);
      }).catch(() => {});
    }

    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const deck = createDeck();
    let player = [deck.pop(), deck.pop()];
    let dealer = [deck.pop(), deck.pop()];

    const pv = handValue(player);
    if (pv === 21) {
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      const dv = handValue(dealer);
      if (dv === 21) {
        return message.channel.send({
          embeds: [buildEmbed({
            name, avatarURL, player, dealer, reveal: true, bet: amount,
            result: `tie — ${amount.toLocaleString()} returned`,
            color: 0xfee75c,
          })],
        });
      }
      const paid = db.payWin(message.author.id, amount);
      return message.channel.send({
        embeds: [buildEmbed({
          name, avatarURL, player, dealer, reveal: true, bet: amount,
          result: `blackjack! won ${(amount + paid).toLocaleString()} (+${paid.toLocaleString()})`,
          color: 0x57f287,
        })],
      });
    }

    activeGames.set(message.author.id, { player, dealer, deck, bet: amount, name, avatarURL });

    const initialButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setEmoji('👊').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setEmoji('🛑').setStyle(ButtonStyle.Danger),
    );
    message.channel.send({
      embeds: [buildEmbed({ name, avatarURL, player, dealer, reveal: false, bet: amount, color: 8240363 })],
      components: [initialButtons],
    }).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
      attachCollector(msg, player, dealer, deck, amount, message.author.id, name, avatarURL);
    }).catch(() => {});
  },
};
