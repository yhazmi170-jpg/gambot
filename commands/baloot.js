const { embed, error, success } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };

// Card values for SUN (normal)
const SUN_VALUES = { '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
// Card values for HOKOM (trump) - Jack and 9 are special
const HOKOM_VALUES = { '7': 0, '8': 0, '9': 14, 'J': 20, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };

// Rank order for comparing cards (higher = stronger in suit)
const RANK_ORDER = { '7': 0, '8': 1, '9': 2, 'J': 3, 'Q': 4, 'K': 5, '10': 6, 'A': 7 };
// Hokom rank order (Jack is strongest, 9 is second)
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

const games = new Map();

module.exports = {
  name: 'baloot',
  helpCategory: 'Games',
  helpArgs: '',
  aliases: ['bloot', 'بلوت'],
  description: 'play Baloot — the classic Arabic card game (4 players, teams of 2)',
  async execute(message, args) {
    const guildId = message.guild.id;
    if (games.has(guildId)) {
      return message.channel.send({ embeds: [error('theres already an active baloot game in this server')] });
    }

    const players = [{ id: message.author.id, username: message.author.username, hand: [], team: 0 }];
    games.set(guildId, {
      players,
      host: message.author.id,
      phase: 'join',
      deck: [],
      trumpSuit: null,
      contract: null, // 'sun' or 'hokom'
      publicCard: null,
      bids: [],
      tricks: [],
      currentTrick: [],
      currentPlayerIdx: 0,
      scores: [0, 0],
      round: 0,
    });

    const joinBtn = new ButtonBuilder().setCustomId('baloot_join').setLabel('Join Game').setStyle(ButtonStyle.Success).setEmoji('🃏');
    const startBtn = new ButtonBuilder().setCustomId('baloot_start').setLabel('Start').setStyle(ButtonStyle.Primary).setEmoji('▶️');
    const row = new ActionRowBuilder().addComponents(joinBtn, startBtn);

    const msg = await message.channel.send({
      embeds: [embed('🃏 Baloot', [
        ['Host', `<@${message.author.id}>`],
        ['Players', `1/4 — <@${message.author.id}>`],
        ['', '**60s** to join — hit **Join Game**!\n4 players needed (teams of 2)'],
      ], 0x9b59b6)],
      components: [row],
    });

    const filter = i => i.customId.startsWith('baloot_') && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: 60000 });

    col.on('collect', async (i) => {
      const game = games.get(guildId);
      if (!game) return;

      if (i.customId === 'baloot_join') {
        if (game.players.find(p => p.id === i.user.id)) {
          return i.reply({ embeds: [error('you already joined')], ephemeral: true });
        }
        if (game.players.length >= 4) {
          return i.reply({ embeds: [error('game is full (4 max)')], ephemeral: true });
        }
        const team = game.players.length % 2; // 0,1,0,1 alternating
        game.players.push({ id: i.user.id, username: i.user.username, hand: [], team });
        const playerList = game.players.map((p, idx) => `${idx + 1}. <@${p.id}> (Team ${p.team + 1})`).join('\n');
        await i.update({
          embeds: [embed('🃏 Baloot', [
            ['Host', `<@${game.host}>`],
            ['Players', `${game.players.length}/4\n${playerList}`],
            ['', '**60s** to join — hit **Join Game**!\n4 players needed (teams of 2)'],
          ], 0x9b59b6)],
        }).catch(() => {});
      }

      if (i.customId === 'baloot_start') {
        if (i.user.id !== game.host) {
          return i.reply({ embeds: [error('only the host can start')], ephemeral: true });
        }
        if (game.players.length < 4) {
          return i.reply({ embeds: [error('need 4 players')], ephemeral: true });
        }
        col.stop('start');
      }
    });

    col.on('end', async (collected, reason) => {
      const game = games.get(guildId);
      if (!game) return;

      if (reason === 'start' && game.players.length === 4) {
        // Deal cards
        game.deck = shuffle(createDeck());
        game.publicCard = game.deck.pop();

        // Deal 3 cards to each player (except the one who will get public card gets 2)
        for (let round = 0; round < 3; round++) {
          for (const player of game.players) {
            if (round === 2 && player === game.players[0]) continue; // skip last card for first player (they get public)
            player.hand.push(game.deck.pop());
          }
        }

        game.phase = 'bid';
        game.currentPlayerIdx = 0;

        await msg.edit({
          embeds: [embed('🃏 Baloot — Bidding Phase', [
            ['Public Card', `${game.publicCard.rank}${game.publicCard.suit}`},
            ['', `Players bid on the public card.\nCall: \`v baloot bid sun\` or \`v baloot bid hokom <suit>\``],
          ], 0x9b59b6)],
          components: [],
        }).catch(() => {});

        // DM each player their hand
        for (const player of game.players) {
          try {
            const user = await message.client.users.fetch(player.id);
            const handStr = player.hand.map(c => `${c.rank}${c.suit}`).join(' ');
            await user.send({ embeds: [embed('🃏 Your Baloot Hand', [['Cards', handStr]], 0x2b2d31)] });
          } catch (e) {}
        }
      } else {
        games.delete(guildId);
        await msg.edit({
          embeds: [embed('🃏 Baloot Cancelled', [['', 'not enough players or time ran out']], 0xed4245)],
          components: [],
        }).catch(() => {});
      }
    });
  },
};
