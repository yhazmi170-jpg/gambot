const { embed, error, success } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES_AR = { '♠': 'بستوني', '♥': 'قلب', '♦': 'ديناري', '♣': 'سباتي' };
const RANKS = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const SUN_VALUES = { '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
const HOKOM_VALUES = { '7': 0, '8': 0, '9': 14, 'J': 20, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
const RANK_ORDER = { '7': 0, '8': 1, '9': 2, 'J': 3, 'Q': 4, 'K': 5, '10': 6, 'A': 7 };
const HOKOM_RANK_ORDER = { '7': 0, '8': 1, 'Q': 2, 'K': 3, '10': 4, 'A': 5, '9': 6, 'J': 7 };

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}${suit}` });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card, isHokom, trumpSuit) {
  if (isHokom && card.suit === trumpSuit) return HOKOM_VALUES[card.rank] || 0;
  return SUN_VALUES[card.rank] || 0;
}

function cardPower(card, isHokom, trumpSuit, leadSuit) {
  if (isHokom && card.suit === trumpSuit) return HOKOM_RANK_ORDER[card.rank] + 100;
  if (card.suit === leadSuit) return RANK_ORDER[card.rank];
  return -1;
}

function botChooseBid(hand) {
  const strongCards = hand.filter(c => ['A', 'K', 'Q', 'J', '10'].includes(c.rank)).length;
  if (strongCards >= 4) return { type: 'hokom', suit: SUITS[Math.floor(Math.random() * 4)] };
  if (strongCards >= 2) return { type: 'sun' };
  return { type: 'pass' };
}

function botPlayCard(hand, trick, isHokom, trumpSuit) {
  const leadSuit = trick.length > 0 ? trick[0].suit : null;
  let validCards = hand;
  if (leadSuit) {
    const followCards = hand.filter(c => c.suit === leadSuit);
    if (followCards.length > 0) validCards = followCards;
  }
  validCards.sort((a, b) => cardPower(a, isHokom, trumpSuit, leadSuit) - cardPower(b, isHokom, trumpSuit, leadSuit));
  return validCards[0];
}

module.exports = {
  name: 'balootsolo',
  aliases: ['balootbot'],
  description: 'لعب البلوت فردي ضد البوتات (للمالك فقط)',
  async execute(message, args) {
    if (message.author.id !== require('../config').ownerId) return;

    const deck = shuffle(createDeck());
    const publicCard = deck.pop();

    const players = [
      { id: message.author.id, username: message.author.username, hand: [], team: 0, isBot: false },
      { id: 'bot1', username: 'بوت ١', hand: [], team: 1, isBot: true },
      { id: 'bot2', username: 'بوت ٢', hand: [], team: 0, isBot: true },
      { id: 'bot3', username: 'بوت ٣', hand: [], team: 1, isBot: true },
    ];

    // توزيع الأوراق
    for (let round = 0; round < 8; round++) {
      for (const player of players) {
        player.hand.push(deck.pop());
      }
    }

    // مرحلة المزايدة
    let contract = 'sun';
    let trumpSuit = null;
    let winner = players[0];

    for (const bot of players.filter(p => p.isBot)) {
      const bid = botChooseBid(bot.hand);
      if (bid.type === 'hokom') {
        contract = 'hokom';
        trumpSuit = bid.suit;
        winner = bot;
        break;
      } else if (bid.type === 'sun' && contract === 'sun') {
        winner = bot;
      }
    }

    const player = players[0];
    const handStr = player.hand.map(c => `${c.rank}${c.suit}`).join(' ');

    const msg = await message.channel.send({
      embeds: [embed('🃏 بلوت فردي', [
        ['الورقة العامة', `${publicCard.rank}${publicCard.suit}`],
        ['يدك', handStr],
        ['العقد', contract === 'hokom' ? `حكم (${SUIT_NAMES_AR[trumpSuit] || trumpSuit})` : 'صن'],
        ['', 'اكتب `صن` لأخذها صن، `حكم <suit>` لحكم، أو `لا` للتمرير'],
      ], 0x9b59b6)],
    });

    const filter = m => m.author.id === message.author.id && ['صن', 'لا', 'حكم'].includes(m.content.toLowerCase().split(' ')[0]);
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 }).catch(() => null);

    if (collected && collected.size > 0) {
      const response = collected.first().content.toLowerCase().split(' ');
      if (response[0] === 'حكم' && SUITS.includes(response[1]?.toUpperCase())) {
        contract = 'hokom';
        trumpSuit = response[1];
        winner = player;
      } else if (response[0] === 'صن') {
        winner = player;
      }
    }

    // لعب الأكلات
    const scores = [0, 0];
    let currentPlayerIdx = players.indexOf(winner);

    for (let trickNum = 0; trickNum < 8; trickNum++) {
      const trick = [];
      const trickCards = [];

      for (let i = 0; i < 4; i++) {
        const playerIdx = (currentPlayerIdx + i) % 4;
        const p = players[playerIdx];
        let card;

        if (p.isBot) {
          card = botPlayCard(p.hand, trick, contract === 'hokom', trumpSuit);
        } else {
          const handStr = p.hand.map(c => `${c.rank}${c.suit}`).join(' ');
          await message.channel.send({
            embeds: [embed(`🃏 أكلة ${trickNum + 1}/8`, [
              ['دورك', handStr],
              ['', 'اكتب ورقة للعب (مثل `A♠` أو `10♥`)'],
            ], 0x2b2d31)],
          });

          const cardFilter = m => m.author.id === message.author.id && p.hand.some(c => m.content.toLowerCase() === `${c.rank}${c.suit}`.toLowerCase());
          const cardCollected = await message.channel.awaitMessages({ filter: cardFilter, max: 1, time: 30000 }).catch(() => null);

          if (cardCollected && cardCollected.size > 0) {
            const cardStr = cardCollected.first().content;
            const idx = p.hand.findIndex(c => `${c.rank}${c.suit}`.toLowerCase() === cardStr.toLowerCase());
            card = p.hand.splice(idx, 1)[0];
          } else {
            card = p.hand.shift();
          }
        }

        if (!card) card = p.hand.shift();
        trick.push(card);
        trickCards.push({ player: p, card });
      }

      // تحديد الفائز بالأكلة
      const leadSuit = trick[0].suit;
      let winningPlay = trickCards[0];
      for (const play of trickCards) {
        if (cardPower(play.card, contract === 'hokom', trumpSuit, leadSuit) > cardPower(winningPlay.card, contract === 'hokom', trumpSuit, leadSuit)) {
          winningPlay = play;
        }
      }

      // تسجيل النقاط
      let trickScore = 0;
      for (const card of trick) {
        trickScore += cardValue(card, contract === 'hokom', trumpSuit);
      }
      scores[winningPlay.player.team] += trickScore;

      if (trickNum === 7) {
        scores[winningPlay.player.team] += 10;  //  bonus الأكلة الأخيرة
      }

      currentPlayerIdx = players.indexOf(winningPlay.player);
    }

    // النتيجة النهائية
    const team1Score = Math.floor(scores[0] / 10) * (contract === 'hokom' ? 1 : 2);
    const team2Score = Math.floor(scores[1] / 10) * (contract === 'hokom' ? 1 : 2);

    const playerTeam = 0;
    const won = scores[playerTeam] > scores[1 - playerTeam];

    await message.channel.send({
      embeds: [embed('🃏 بلوت فردي — انتهت اللعبة', [
        ['فريقك (أنت + بوت ٢)', `${team1Score} نقطة`],
        ['الفريق الخصم (بوت ١ + بوت ٣)', `${team2Score} نقطة`],
        ['', won ? '🎉 **فزت!** 🏆' : '😔 حظ أوفر المرة الجاية!'],
      ], won ? 0x57f287 : 0xed4245)],
    });
  },
};
