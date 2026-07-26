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
        desc: 'A 50/50 gambling game. Bet on heads or tails and double your money if you win.',
        play: `\`${prefix} cf <amount> heads/tails\`\nExample: \`${prefix} cf 1000 heads\``,
        tips: 'Pure luck. No strategy. If you have the **lucky** perk, wins pay 3x instead of 2x.',
      },
      slots: {
        name: 'Slots',
        desc: 'A 3-reel slot machine. Match symbols across the reels to win multipliers on your bet.',
        play: `\`${prefix} slots <amount>\`\nExample: \`${prefix} slots 1000\``,
        tips: 'Higher bets = higher payouts. Match 3 rare symbols for the biggest wins. Slow and steady.',
      },
      dice: {
        name: 'Dice',
        desc: 'A random number 1-100 is rolled. Predict if it\'ll be over or under a target number.',
        play: `\`${prefix} dice <amount> over/under <num>\`\nExample: \`${prefix} dice 1000 over 50\``,
        tips: 'Over/under 50 is true 50/50. Closer to 1 or 100 = higher risk, higher payout.',
      },
      roulette: {
        name: 'Roulette',
        desc: 'Classic roulette. The wheel spins and a ball lands on a color and number.',
        play: `\`${prefix} roulette <amount> <red/black/green/num>\`\nExample: \`${prefix} roulette 1000 red\``,
        tips: 'Red/black pays 2x (~50% odds). Green pays 14x (~2.7%). A specific number pays 36x.',
      },
      bj: {
        name: 'Blackjack',
        desc: 'Beat the dealer\'s hand without going over 21. Face cards = 10, Aces = 1 or 11. Draw cards (Hit) or stay (Stand). Closest to 21 wins.',
        play: `\`${prefix} bj <amount>\`\nButtons: **Hit** = draw a card, **Stand** = keep your hand\nExample: \`${prefix} bj 1000\``,
        tips: 'Hit on 11 or below. Stand on 17+. If dealer shows 2-6, play safe — they might bust. If 7+, play aggressive. Lucky perk pays 3x on win.',
      },
      mines: {
        name: 'Mines',
        desc: 'A 5x5 grid hides mines. Click safe tiles to reveal and grow your multiplier. Hit a mine and you lose everything. Cash out anytime.',
        play: `\`${prefix} mines <amount>\`\nClick tiles to reveal, click Cash Out to keep winnings\nExample: \`${prefix} mines 1000\``,
        tips: 'Cash out early for consistent small profits. The more tiles you reveal, the higher the multiplier — but one wrong click loses it all.',
      },
      crash: {
        name: 'Crash',
        desc: 'A multiplier starts at 1x and climbs. Cash out before it crashes. If you don\'t cash out in time, you lose your bet.',
        play: `\`${prefix} crash <amount> <multiplier>\`\nExample: \`${prefix} crash 1000 2.5\``,
        tips: '1.5x-2x is safe and consistent. 5x+ is rare but pays big. Don\'t get greedy — cash out early.',
      },
      lottery: {
        name: 'Lottery',
        desc: 'Buy tickets for a chance to win the pot. A winner is drawn every hour. The pot = total tickets x 10.',
        play: `\`${prefix} lottery buy <amount>\`\nEach ticket costs 10 coins\nExample: \`${prefix} lottery buy 100\``,
        tips: 'More tickets = higher chance to win. The **lottery_ticket** perk gives a free ticket every draw.',
      },
    };

    if (game && games[game]) {
      const g = games[game];
      return message.channel.send({
        embeds: [embed(`🎮 ${g.name}`, [
          ['What it is', g.desc],
          ['How to Play', g.play],
          ['Tips', g.tips],
        ], 0x2b2d31)],
      });
    }

    const list = Object.entries(games).map(([key, g]) => `\`${prefix} ${key}\` — ${g.name}`).join('\n');
    message.channel.send({ embeds: [embed('📖 Game Help', [
      ['Usage', `\`${prefix} gamehelp <game>\` — get rules and tips for a specific game`],
      ['Games', list],
    ], 0x2b2d31)] });
  },
};
