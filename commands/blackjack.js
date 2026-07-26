const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config.json');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

function cardDisplay(card) {
  return `${card.value}${card.suit}`;
}

function formatCards(cards) {
  return cards.map(c => `\`${c.value}${c.suit}\``).join(' ');
}

function buildResult(player, dealer, revealDealer) {
  return revealDealer
    ? `${formatCards(dealer)} **${handValue(dealer)}**`
    : `${formatCards([dealer[0]])} + \`?\``;
}

function playLoop(msg, player, dealer, deck, bet, userId) {
  const pv = handValue(player);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger),
  );

  msg.edit({
    embeds: [embed('🃏 Blackjack', [
      ['📌 Your Hand', `${formatCards(player)} — **${pv}**`],
      ['🃏 Dealer', buildResult(player, dealer, false)],
    ])],
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
            embeds: [embed('🃏 Blackjack', [
              ['📌 Your Hand', `${formatCards(player)} — **${npv}**`],
              ['🃏 Dealer', `${formatCards(dealer)} — **${handValue(dealer)}**`],
              ['💥 Result', `**Bust!** Lost **${bet}** ${config.currency}${refund > 0 ? `\n🛡️ Insurance refund: **${refund}**` : ''}`],
            ], 0xed4245)],
            components: [],
          });
          return;
        }
        await interaction.deferUpdate();
        playLoop(msg, player, dealer, deck, bet, userId);
      } else {
        while (handValue(dealer) < 17) dealer.push(deck.pop());
        const dv = handValue(dealer);
        const pv2 = handValue(player);
        const isLucky = db.ensureUser(userId).lucky;
        let result, color;
        if (dv > 21 || pv2 > dv) { const profit = bet * (isLucky ? 3 : 1); result = `won **${bet + profit}** (+**${profit}**) ${config.currency}`; color = 0x57f287; db.addBalance(userId, profit); db.addWon(userId, profit); }
        else if (pv2 === dv) { result = `tie — **${bet}** returned`; color = 0xfee75c; }
        else { const refund = db.getInsuranceRefund(userId, bet); if (refund > 0) db.addBalance(userId, refund); result = `lost **${bet}** ${config.currency}${refund > 0 ? ` (🛡️ **${refund}** refunded)` : ''}`; color = 0xed4245; db.addBalance(userId, -bet); db.addGambled(userId, bet); }
        await interaction.update({
          embeds: [embed('🃏 Blackjack', [
            ['📌 Your Hand', `${formatCards(player)} — **${pv2}**`],
            ['🃏 Dealer', `${formatCards(dealer)} — **${dv}**`],
            ['🎯 Result', result],
          ], color)],
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
        if (dv > 21 || pv2 > dv) { const profit = bet * (isLucky ? 3 : 1); result = `won **${bet + profit}** (+**${profit}**) ${config.currency}`; color = 0x57f287; db.addBalance(userId, profit); db.addWon(userId, profit); }
        else if (pv2 === dv) { result = `tie — **${bet}** returned`; color = 0xfee75c; }
        else { result = `lost **${bet}** ${config.currency}`; color = 0xed4245; db.addBalance(userId, -bet); db.addGambled(userId, bet); }
        await msg.edit({
          embeds: [embed('🃏 Blackjack', [
            ['📌 Your Hand', `${formatCards(player)} — **${pv2}**`],
            ['🃏 Dealer', `${formatCards(dealer)} — **${dv}**`],
            ['⏰ Result', `${result} (timed out)`],
          ], color)],
          components: [],
        }).catch(() => {});
      }
    });
  });
}

module.exports = {
  name: 'blackjack',
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

    const lucky = db.ensureUser(message.author.id).lucky;
    const deck = createDeck();
    let player = [deck.pop(), deck.pop()];
    let dealer = [deck.pop(), deck.pop()];
    if (lucky) {
      while (handValue(player) < 21) player.push(deck.pop());
      if (handValue(player) > 21) player = [deck.pop(), deck.pop()];
    }

    const pv = handValue(player);
    if (pv === 21) {
      const profit = amount * (lucky ? 3 : 1);
      db.addBalance(message.author.id, profit);
      db.addWon(message.author.id, profit);
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      return message.channel.send({
        embeds: [embed('🃏 Blackjack', [
          ['📌 Your Hand', `${formatCards(player)} — **21** 🎉`],
          ['🃏 Dealer', `${formatCards(dealer)} — **${handValue(dealer)}**`],
          ['🎯 Result', `**Blackjack!** Won **${amount + profit}** (+**${profit}**) ${config.currency}`],
        ], 0x57f287)],
      });
    }

    message.channel.send({ embeds: [embed('🃏 Blackjack', [['♠ Dealing...', ' shuffling cards']])] }).then(msg => {
      playLoop(msg, player, dealer, deck, amount, message.author.id);
    });
  },
};
