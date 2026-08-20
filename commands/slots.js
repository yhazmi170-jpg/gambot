const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const REELS = ['🍒', '🍇', '🍊', '🍋', '🍉', '💎', '7️⃣'];
const payouts = {
  3: { 0: 3, 1: 4, 2: 5, 3: 6, 4: 8, 5: 15, 6: 50 },
  2: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 3, 5: 5, 6: 10 },
};

function spin() {
  return [
    Math.floor(Math.random() * REELS.length),
    Math.floor(Math.random() * REELS.length),
    Math.floor(Math.random() * REELS.length),
  ];
}

function calcWin(reels, bet) {
  const [a, b, c] = reels;
  if (a === b && b === c) return bet * payouts[3][a];
  if (a === b || b === c || a === c) {
    const pair = a === b ? a : b === c ? c : a;
    return Math.floor(bet * payouts[2][pair]);
  }
  return 0;
}

function slotLine(reels, revealCount) {
  return reels.map((r, i) => revealCount > i ? REELS[r] : '⬜').join(' ');
}

module.exports = {
  name: 'slots',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'spin the slots',
  aliases: ['slot', 'spin'],
  async execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const lucky = db.ensureUser(message.author.id).lucky;
    let reels = spin();
    if (lucky) {
      const jackpot = Math.random() < 0.5 ? 6 : Math.floor(Math.random() * 6);
      reels = [jackpot, jackpot, jackpot];
    }

    const msg = await message.channel.send({
      embeds: [embed('🎰 Slots', [
        ['___SLOTS___', `\`\`\`${slotLine(reels, 0)}\`\`\``],
        ['bet', `${amount} ${config.currency}`],
      ])],
    });

    await sleep(500);
    await msg.edit({
      embeds: [embed('🎰 Slots', [
        ['___SLOTS___', `\`\`\`${slotLine(reels, 1)}\`\`\``],
        ['bet', `${amount} ${config.currency}`],
      ])],
    });

    await sleep(500);
    await msg.edit({
      embeds: [embed('🎰 Slots', [
        ['___SLOTS___', `\`\`\`${slotLine(reels, 2)}\`\`\``],
        ['bet', `${amount} ${config.currency}`],
      ])],
    });

    await sleep(500);

    const winnings = calcWin(reels, amount);

    if (winnings > 0) {
      const net = winnings - amount;
      const paid = db.payWin(message.author.id, net);
      const jackpot = reels[0] === 6 && reels[1] === 6 && reels[2] === 6;
      await msg.edit({
        embeds: [embed('🎰 Slots', [
          ['___SLOTS___', `\`\`\`${slotLine(reels, 3)}\`\`\``],
          ['bet', `${amount} ${config.currency}`],
          ...(jackpot
            ? [['💰 JACKPOT 💰', '**50x — you just hit the jackpot!**']]
            : [['payout', `**${amount + paid}** ${config.currency} (+**${paid}**)`]]),
        ], jackpot ? 0xfee75c : 0x57f287)],
      });
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) db.addBalance(message.author.id, refund);
      await msg.edit({
        embeds: [embed('🎰 Slots', [
          ['___SLOTS___', `\`\`\`${slotLine(reels, 3)}\`\`\``],
          ['bet', `${amount} ${config.currency}`],
          ['result', refund > 0 ? `won nothing... (🛡️ **${refund}** refunded)` : `won nothing... :c`],
        ], 0xed4245)],
      });
    }
  },
};
