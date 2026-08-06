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
        desc: 'Buy tickets for the hourly pot. Pot = tickets A- 10 (cut applied).',
        play: `\`${prefix} lottery buy <tickets>\`\nEach ticket costs 10\nExample: \`${prefix} lottery buy 100\``,
        tips: 'More tickets = better odds. lottery_ticket perk = free ticket each draw.',
      },
      heist: {
        name: 'Heist',
        aliases: 'heist',
        desc: 'Start a heist with an entry fee. Others join, then the crew rolls to pull off a big payout.',
        play: `\`${prefix} heist <fee>\`\nOthers hit **Join Heist**\nExample: \`${prefix} heist 50k\``,
        tips: 'Needs at least 2 players or it is called off and refunded. Winners split the pot.',
      },
      race: {
        name: 'Pet Race',
        aliases: 'race',
        desc: 'Race your best pet against other players\' pets. Fastest one takes the pot.',
        play: `\`${prefix} race <fee>\`\nOthers hit **Join Race**\nExample: \`${prefix} race 20k\``,
        tips: 'Your best pet auto-enters. Needs 2+ racers or it is cancelled and refunded.',
      },
      tournament: {
        name: 'Tournament',
        aliases: 'tourney, tour',
        desc: 'A bracket tournament of pets. Pay the entry fee, pets fight head-to-head, one champion takes the pot.',
        play: `\`${prefix} tournament <fee>\`\nOthers hit **Join Tournament**\nExample: \`${prefix} tournament 50k\``,
        tips: 'Up to 16 entrants. Winner takes 90% of the pot, the house takes 10%.',
      },
      stocks: {
        name: 'Stocks',
        aliases: 'stock, market',
        desc: 'Buy and sell stocks. The market drifts every hour — buy low, sell high.',
        play: `\`${prefix} stocks\` — view market\n\`${prefix} stocks buy <symbol> <amount>\`\n\`${prefix} stocks sell <symbol> <amount>\`\n\`${prefix} stocks port\` — your portfolio`,
        tips: 'Check the market before buying. Prices change every hour.',
      },
      hatch: {
        name: 'Egg Hatch',
        aliases: 'hatchegg, openegg',
        desc: 'Hatch eggs found while hunting. Rarer eggs hatch rarer animals.',
        play: `\`${prefix} hatch\` — open one egg\n\`${prefix} hatch all\` — open them all`,
        tips: 'Eggs drop randomly while hunting and autohunting. Egg Luck perk doubles the drop rate.',
      },
      dex: {
        name: 'Animal Dex',
        aliases: 'index, collection, pokedex',
        desc: 'See which species you own and which you\'re still missing.',
        play: `\`${prefix} dex\` — full collection\n\`${prefix} dex rare\` — one rarity`,
        tips: 'Bold = owned. Crossed out = missing. Collect all 35 species!',
      },
      animal: {
        name: 'Animal Stats',
        aliases: 'pet, info, stats',
        desc: 'View an animal\'s full combat stats — HP, attack, defense, and XP progress.',
        play: `\`${prefix} animal <id>\` — by id from \`v zoo\`\n\`${prefix} animal dragon\` — by species\n\`${prefix} animal rex\` — by custom name`,
        tips: 'Matches by id, species, or your custom name. Shows the progress bar to its next level.',
      },
      quest: {
        name: 'Daily Quest',
        aliases: 'q',
        desc: 'A daily task with a coin reward. Complete it before the day resets.',
        play: `\`${prefix} quest\` — view\n\`${prefix} quest claim\` — claim when done`,
        tips: 'Quest progress tracks hunts, sacrifices, wins, work, gives, and battles. Double Quest Rewards perk = 2x payout.',
      },
      bounty: {
        name: 'Weekly Bounty',
        aliases: 'bnt',
        desc: 'A weekly challenge with a big coin reward. Bigger goal, bigger payout.',
        play: `\`${prefix} bounty\` — view\n\`${prefix} bounty claim\` — claim when done`,
        tips: 'Resets every week. Same tasks as the daily quest but bigger. Double Quest Rewards perk applies.',
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
