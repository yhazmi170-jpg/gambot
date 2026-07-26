const { embed } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'gamehelp',
  helpCategory: 'Games',
  helpArgs: '<game>',
  aliases: ['gh', 'howto', 'tutorial'],
  description: 'get rules and tips for a game',
  execute(message, args) {
    const game = (args[0] || '').toLowerCase();
    const prefix = config.prefixes[0];

    const games = {
      cf: {
        name: 'Coinflip',
        aliases: 'cf, coin, flip',
        desc: 'A 50/50 gambling game. Bet on heads or tails. Wins pay even money (more with lucky).',
        play: `\`${prefix} cf <amount> heads/tails\`\nExample: \`${prefix} cf 1000 heads\``,
        tips: 'Pure luck. High balance slightly lowers win payouts. Lucky perk pays 3x.',
      },
      slots: {
        name: 'Slots',
        aliases: 'slot, spin',
        desc: 'A 3-reel slot machine. Match symbols to win multipliers on your bet.',
        play: `\`${prefix} slots <amount>\`\nExample: \`${prefix} slots 1000\``,
        tips: 'Match 3 rare symbols for the biggest wins. High bal = slightly smaller net wins.',
      },
      dice: {
        name: 'Dice',
        aliases: 'roll',
        desc: 'A number 1-100 is rolled. Predict over or under a target.',
        play: `\`${prefix} dice <amount> over/under <num>\`\nExample: \`${prefix} dice 1000 over 50\``,
        tips: 'Over/under 50 is ~50/50. Closer to the edge = higher payout, higher risk.',
      },
      roulette: {
        name: 'Roulette',
        aliases: 'roul, wheel',
        desc: 'Bet on red, black, green, or a number. Wheel spins.',
        play: `\`${prefix} roulette <amount> <red/black/green/num>\`\nExample: \`${prefix} roulette 1000 red\``,
        tips: 'Red/black ~2x. Green ~14x. Exact number ~36x.',
      },
      bj: {
        name: 'Blackjack',
        aliases: 'bj, twentyone, blackjack',
        desc: 'Beat the dealer without going over 21. Layout shows Dealer [10+?] with a hidden card, then your hand total — owo style.',
        play: `\`${prefix} bj <amount>\`\nButtons: **Hit** draw, **Stand** keep\nExample: \`${prefix} bj 1000\``,
        tips: 'Hit on 11 or below. Stand on 17+. Dealer hits to 17. High bal slightly lowers win payouts.',
      },
      poker: {
        name: 'Video Poker',
        aliases: 'poker, videopoker',
        desc: 'VIP game. Get dealt 5 cards, hold what you want, draw the rest. Jacks or better to win.',
        play: `\`${prefix} poker <amount>\`\nToggle hold on each card, then **DRAW**\nRequires **VIP game modes** perk (or owner)\nExample: \`${prefix} poker 1000\``,
        tips: 'Hold pairs of jacks+. Paytable: RF 800× · SF 50× · 4K 25× · FH 9× · Fl 6× · St 4× · 3K 3× · 2P 2× · JoB 1×',
      },
      mines: {
        name: 'Mines',
        aliases: 'mine, mines',
        desc: '5x5 grid with mines. Reveal safe tiles to grow multiplier. Cash out anytime.',
        play: `\`${prefix} mines <amount>\`\nClick tiles, or **Cash Out**\nExample: \`${prefix} mines 1000\``,
        tips: 'Cash out early for steady profit. One mine ends the round.',
      },
      crash: {
        name: 'Crash',
        aliases: 'crsh',
        desc: 'Multiplier climbs from 1x. Set a cashout target before it crashes.',
        play: `\`${prefix} crash <amount> <multiplier>\`\nExample: \`${prefix} crash 1000 2.5\``,
        tips: '1.5x–2x is safer. High targets pay more but bust often.',
      },
      lottery: {
        name: 'Lottery',
        aliases: 'lotto, lot',
        desc: 'Buy tickets for the hourly pot. Pot = tickets × 10 (cut applied).',
        play: `\`${prefix} lottery buy <tickets>\`\nEach ticket costs 10\nExample: \`${prefix} lottery buy 100\``,
        tips: 'More tickets = better odds. lottery_ticket perk = free ticket each draw.',
      },
    };

    // alias map
    const aliasToKey = {};
    for (const [key, g] of Object.entries(games)) {
      aliasToKey[key] = key;
      aliasToKey[g.name.toLowerCase()] = key;
      for (const a of (g.aliases || '').split(',').map(s => s.trim()).filter(Boolean)) {
        aliasToKey[a.toLowerCase()] = key;
      }
    }

    const key = aliasToKey[game];
    if (game && key && games[key]) {
      const g = games[key];
      return message.channel.send({
        embeds: [embed(`🎮 ${g.name}`, [
          ['What it is', g.desc],
          ['How to Play', g.play],
          ['Tips', g.tips],
        ], 0x2b2d31)],
      });
    }

    const list = Object.entries(games).map(([k, g]) => `\`${prefix} gamehelp ${k}\` — ${g.name}`).join('\n');
    message.channel.send({ embeds: [embed('📖 Game Help', [
      ['Usage', `\`${prefix} gamehelp <game>\` — rules + tips`],
      ['Games', list],
      ['Note', 'Higher balance slightly reduces gambling wins and daily/work/weekly — not by much.'],
    ], 0x2b2d31)] });
  },
};
