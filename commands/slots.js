const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config.json');

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
  aliases: ['slot', 'spin'],
  async execute(message, args) {
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
      db.addBalance(message.author.id, net);
      db.addWon(message.author.id, net);
      await msg.edit({
        embeds: [embed('🎰 Slots', [
          ['___SLOTS___', `\`\`\`${slotLine(reels, 3)}\`\`\``],
          ['bet', `${amount} ${config.currency}`],
          ['payout', `**${winnings}** ${config.currency} (+**${net}**)`],
        ], 0x57f287)],
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
