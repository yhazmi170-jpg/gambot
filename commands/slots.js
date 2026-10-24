const db = require('../db');
const { card, error } = require('../utils/embed');
const config = require('../config');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const REELS = ['🍒', '🍇', '🍊', '🍋', '🍉', '💎', '7️⃣'];
const payouts = {
  3: { 0: 3, 1: 3, 2: 4, 3: 4, 4: 6, 5: 10, 6: 30 },
  2: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 3, 5: 4, 6: 6 },
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

function renderSlotMachine(reels, revealCount) {
  const display = reels.map((r, i) => (revealCount > i ? REELS[r] : '🌀')).join('  ┆  ');
  return `╭─────── 🎰 **SLOTS** ───────╮\n│      ${display}      │ ◄\n╰─────────────────────────────╯`;
}

module.exports = {
  name: 'slots',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'spin the slots',
  aliases: ['slot'],
  async execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    let reels = spin();

    const msg = await message.channel.send({
      embeds: [card({
        title: '🎰 Vegas Slot Machine',
        description: `${renderSlotMachine(reels, 0)}\n\n*Spinning the reels...*`,
        fields: [
          ['Wager', `**${amount.toLocaleString()}** ${config.currency}`, true],
          ['Status', '🟡 **Rolling...**', true],
        ],
        color: 0x5865f2,
        footer: `Player: ${message.author.username}`,
      })],
    }).catch(err => {
      console.error('Failed to send initial slots message:', err);
      return null;
    });
    if (!msg) return;

    await sleep(400);
    await msg.edit({
      embeds: [card({
        title: '🎰 Vegas Slot Machine',
        description: `${renderSlotMachine(reels, 1)}\n\n*Locking reels...*`,
        fields: [
          ['Wager', `**${amount.toLocaleString()}** ${config.currency}`, true],
          ['Status', '🟡 **Reel 1 Locked**', true],
        ],
        color: 0x5865f2,
        footer: `Player: ${message.author.username}`,
      })],
    }).catch(() => {});

    await sleep(400);
    await msg.edit({
      embeds: [card({
        title: '🎰 Vegas Slot Machine',
        description: `${renderSlotMachine(reels, 2)}\n\n*Locking reels...*`,
        fields: [
          ['Wager', `**${amount.toLocaleString()}** ${config.currency}`, true],
          ['Status', '🟡 **Reel 2 Locked**', true],
        ],
        color: 0x5865f2,
        footer: `Player: ${message.author.username}`,
      })],
    }).catch(() => {});

    await sleep(400);

    const winnings = calcWin(reels, amount);

    if (winnings > 0) {
      const net = winnings - amount;
      const paid = db.payWin(message.author.id, net);
      const jackpot = reels[0] === 6 && reels[1] === 6 && reels[2] === 6;
      const mult = (winnings / amount).toFixed(1);
      await msg.edit({
        embeds: [card({
          title: jackpot ? '💥 777 MEGA JACKPOT! 💥' : '🎉 WINNER!',
          description: `${renderSlotMachine(reels, 3)}\n\n${jackpot ? '✨ **TRIPLE SEVENS — JACKPOT HIT!** ✨' : '🎉 **Congratulations! Winning spin!**'}`,
          fields: [
            ['Wager', `**${amount.toLocaleString()}** ${config.currency}`, true],
            ['Multiplier', `**${mult}x**`, true],
            ['Payout', `**+${paid.toLocaleString()}** ${config.currency}`, true],
          ],
          color: jackpot ? 0xffd700 : 0x57f287,
          footer: `Player: ${message.author.username} • Net: +${paid.toLocaleString()} ${config.currency}`,
        })],
      }).catch(() => {});
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) db.addBalance(message.author.id, refund);
      await msg.edit({
        embeds: [card({
          title: '🎰 Slots — No Match',
          description: `${renderSlotMachine(reels, 3)}\n\n${refund > 0 ? '🛡️ *Insurance activated! Partial refund credited.*' : '*Better luck next spin!*'}`,
          fields: [
            ['Wager', `**${amount.toLocaleString()}** ${config.currency}`, true],
            ['Result', refund > 0 ? `Lost **${amount.toLocaleString()}**\n🛡️ **+${refund.toLocaleString()}** refunded` : `Lost **${amount.toLocaleString()}** ${config.currency}`, true],
          ],
          color: 0xed4245,
          footer: `Player: ${message.author.username}`,
        })],
      }).catch(() => {});
    }
  },
};
