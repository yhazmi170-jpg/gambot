const { embed } = require('../utils/embed');

module.exports = {
  name: 'gamehelp',
  aliases: ['gh', 'howto', 'tutorial'],
  description: 'get rules and tips for a game',
  execute(message, args) {
    const game = (args[0] || '').toLowerCase();
    const prefix = 'v';

    const games = {
      cf: {
        name: 'Coinflip',
        fields: [
          ['How to Play', `\`${prefix} cf <amount> heads/tails\`\nBet on heads or tails. Win = double your bet. Lose = lose your bet.`],
          ['Tips', 'Pure 50/50 luck. No strategy — just pick one and pray. If you have the **lucky** perk, wins pay 3x instead of 2x.'],
        ],
      },
      slots: {
        name: 'Slots',
        fields: [
          ['How to Play', `\`${prefix} slots <amount>\`\nSpin a 3-reel slot machine. Match 3 symbols to win big.`],
          ['Tips', 'Higher bets = higher potential payouts. Payout multiplier depends on symbol rarity. This is a slow burner — small bets over time.'],
        ],
      },
      dice: {
        name: 'Dice',
        fields: [
          ['How to Play', `\`${prefix} dice <amount> over/under <num>\`\nA random 1-100 roll. Bet over/under a number. Win if your prediction is right.`],
          ['Tips', `Betting over/under 50 is 50/50. The closer to 1/100 you go, the higher the payout but lower the odds. Under 10 or over 90 pays the most.`],
        ],
      },
      roulette: {
        name: 'Roulette',
        fields: [
          ['How to Play', `\`${prefix} roulette <amount> <red/black/green/num>\`\nBet on red, black, green, or a specific 0-36 number.`],
          ['Tips', 'Red/black = ~50/50 chance, pays 2x. Green = ~2.7% chance, pays 14x. Specific number = ~2.7% chance, pays 36x. Green/number is high risk high reward.'],
        ],
      },
      bj: {
        name: 'Blackjack',
        fields: [
          ['How to Play', `\`${prefix} bj <amount>\`\nGet as close to 21 as possible without going over. Face cards = 10, Aces = 1 or 11. Press **Hit** for another card, **Stand** to stay.`],
          ['Tips', 'Always hit on 11 or below. Stand on 17+. If dealer shows 2-6, they might bust — play safe. If dealer shows 7+, play aggressive. Lucky perk pays 3x on win.'],
        ],
      },
      mines: {
        name: 'Mines',
        fields: [
          ['How to Play', `\`${prefix} mines <amount>\`\nA 5x5 grid. Click safe tiles to reveal. Hit a mine and you lose. Cash out anytime to keep your winnings.`],
          ['Tips', 'The more tiles you reveal, the higher the multiplier. Cash out early for small but consistent profits. Greed = bust.'],
        ],
      },
      crash: {
        name: 'Crash',
        fields: [
          ['How to Play', `\`${prefix} crash <amount> <multiplier>\`\nA multiplier starts at 1x and climbs. Cash out before it crashes. If it crashes before you cash out, you lose.`],
          ['Tips', 'Low multiplier (1.5x-2x) = higher chance of winning but low profit. High multiplier (5x+) = rare but pays big. Don\'t get greedy.'],
        ],
      },
      lottery: {
        name: 'Lottery',
        fields: [
          ['How to Play', `\`${prefix} lottery buy <amount>\`\nBuy tickets. Each ticket = 1 entry. A random winner is drawn every hour. The pot is total tickets x 10.`],
          ['Tips', 'More tickets = higher chance. The **lottery_ticket** perk gives you a free ticket every draw. The pot resets each draw.'],
        ],
      },
    };

    if (game && games[game]) {
      const g = games[game];
      return message.channel.send({ embeds: [embed(`🎮 ${g.name} — Rules & Tips`, g.fields, 0x2b2d31)] });
    }

    const list = Object.entries(games).map(([key, g]) => `\`${prefix} ${key}\` — ${g.name}`).join('\n');
    message.channel.send({ embeds: [embed('📖 Game Help', [
      ['Usage', `\`${prefix} gamehelp <game>\` — get rules and tips for a specific game`],
      ['Games', list],
    ], 0x2b2d31)] });
  },
};
