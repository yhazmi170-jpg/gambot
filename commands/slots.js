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

module.exports = {
  name: 'slots',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'spin the slots',
  aliases: ['slot', 's'],
  async execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const authorName = message.author.username || 'Player';
    const currency = config.currency;

    const top = spin();
    const middle = spin();
    const bottom = spin();

    const initialEmbed = card({
      description:
        `🎰 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and pulled the slot machine!\n\n` +
        `___SLOTS___\n` +
        `  🌀 | 🌀 | 🌀\n` +
        `  🌀 | 🌀 | 🌀  ◄\n` +
        `  🌀 | 🌀 | 🌀\n\n` +
        `*The reels are spinning...*`,
      color: 0x5865f2,
    });

    const initialMsg = await message.channel.send({ embeds: [initialEmbed] }).catch(err => {
      console.error('Failed to send initial slots message:', err);
      return null;
    });
    if (!initialMsg) return;

    const delay = process.env.DB_PATH ? 10 : 750;
    await sleep(delay);

    const winnings = calcWin(middle, amount);
    let outcomeText = '';
    const jackpot = middle[0] === 6 && middle[1] === 6 && middle[2] === 6;

    if (winnings > 0) {
      const net = winnings - amount;
      const paid = db.payWin(message.author.id, net);
      if (jackpot) {
        outcomeText = `... and hit the **777 MEGA JACKPOT**! You won **${paid.toLocaleString()}** ${currency}!`;
      } else {
        outcomeText = `... and you won **${paid.toLocaleString()}** ${currency}!`;
      }
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) {
        db.addBalance(message.author.id, refund);
        outcomeText = `... and you lost **${amount.toLocaleString()}** ${currency}... (🛡️ **${refund.toLocaleString()}** refunded)`;
      } else {
        outcomeText = `... and you lost **${amount.toLocaleString()}** ${currency}...`;
      }
    }

    const t = top.map(i => REELS[i]).join(' | ');
    const m = middle.map(i => REELS[i]).join(' | ');
    const b = bottom.map(i => REELS[i]).join(' | ');

    const color = jackpot ? 0xffd700 : (winnings > 0 ? 0x57f287 : 0xed4245);
    const finalEmbed = card({
      description:
        `🎰 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and pulled the slot machine!\n\n` +
        `___SLOTS___\n` +
        `  ${t}\n` +
        `  ${m}  ◄\n` +
        `  ${b}\n\n` +
        outcomeText,
      color,
    });

    await initialMsg.edit({ embeds: [finalEmbed] }).catch(() => {});
  },
};
