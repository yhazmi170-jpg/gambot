const db = require('../db');
const { error } = require('../utils/embed');
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

const SPIN_EMOJI = '<a:slot_spin:1563712006627008624>';

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

    const reels = spin();

    const initialContent =
      `🎰 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and pulled the slot machine!\n\n` +
      `**\` ___SLOTS___ \`**\n` +
      `${SPIN_EMOJI}  ${SPIN_EMOJI}  ${SPIN_EMOJI}`;

    const initialMsg = await message.channel.send(initialContent).catch(err => {
      console.error('Failed to send initial slots message:', err);
      return null;
    });
    if (!initialMsg) return;

    const isTest = process.env.TEST === '1' || (process.env.DB_PATH && process.env.DB_PATH.startsWith('/tmp'));
    const delay = isTest ? 10 : 600;
    await sleep(delay);

    // Frame 1: Left reel (index 0) locked
    await initialMsg.edit(
      `🎰 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and pulled the slot machine!\n\n` +
      `**\` ___SLOTS___ \`**\n` +
      `${REELS[reels[0]]}  ${SPIN_EMOJI}  ${SPIN_EMOJI}`
    ).catch(() => {});

    await sleep(delay);

    // Frame 2: Right reel (index 2) locked (OwO reveal order: left -> right -> center)
    await initialMsg.edit(
      `🎰 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and pulled the slot machine!\n\n` +
      `**\` ___SLOTS___ \`**\n` +
      `${REELS[reels[0]]}  ${SPIN_EMOJI}  ${REELS[reels[2]]}`
    ).catch(() => {});

    await sleep(delay);

    const winnings = calcWin(reels, amount);
    let outcomeText = '';
    const jackpot = reels[0] === 6 && reels[1] === 6 && reels[2] === 6;

    if (winnings > 0) {
      const net = winnings - amount;
      const paid = db.payWin(message.author.id, net);
      const gross = amount + paid;
      if (jackpot) {
        outcomeText = `... and hit the **777 MEGA JACKPOT**! You won **${gross.toLocaleString()}** ${currency}! (+**${paid.toLocaleString()}** net)`;
      } else {
        outcomeText = `... and you won **${gross.toLocaleString()}** ${currency}! (+**${paid.toLocaleString()}** net)`;
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

    const finalContent =
      `🎰 **${authorName}** spent **${amount.toLocaleString()}** ${currency} and pulled the slot machine!\n\n` +
      `**\` ___SLOTS___ \`**\n` +
      `${REELS[reels[0]]}  ${REELS[reels[1]]}  ${REELS[reels[2]]}\n\n` +
      outcomeText;

    await initialMsg.edit(finalContent).catch(() => {});
  },
};
