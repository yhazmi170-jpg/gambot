const db = require('../db');
const { error } = require('../utils/embed');
const config = require('../config');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const REELS = ['💖', '🍆', '🍒', '🍊', '🍇', '💎', '7️⃣'];
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

function renderSlotsFrame(r1, r2, r3, betStr, line3Extra = '') {
  return (
    `**  \`___SLOTS___\`**\n` +
    `\` \` ${r1} ${r2} ${r3} \` \` ⃟ bet ${betStr}\n` +
    `  \`|         |\` ${line3Extra}\n` +
    `  \`|         |\``
  );
}

module.exports = {
  name: 'slots',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'spin the slot machine',
  aliases: ['slot', 's'],
  async execute(message, args) {
    const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
    if (betError) return message.channel.send({ embeds: [error(betError)] });

    const user = db.ensureUser(message.author.id);
    if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });

    const currency = config.currency;
    const betStr = `${currency} ${amount.toLocaleString()}`;

    const reels = spin();

    const isTest = process.env.TEST === '1' || (process.env.DB_PATH && process.env.DB_PATH.startsWith('/tmp'));
    const delay = isTest ? 10 : 600;

    // Stage 0: all reels spinning
    const initialContent = renderSlotsFrame(SPIN_EMOJI, SPIN_EMOJI, SPIN_EMOJI, betStr);
    const initialMsg = await message.channel.send(initialContent).catch(() => null);
    if (!initialMsg) return;

    await sleep(delay);

    // Stage 1: Reel 1 (left) locked
    await initialMsg.edit(
      renderSlotsFrame(REELS[reels[0]], SPIN_EMOJI, SPIN_EMOJI, betStr)
    ).catch(() => {});

    await sleep(delay);

    // Stage 2: Reel 3 (right) locked (OwO order: left -> right -> center)
    await initialMsg.edit(
      renderSlotsFrame(REELS[reels[0]], SPIN_EMOJI, REELS[reels[2]], betStr)
    ).catch(() => {});

    await sleep(delay);

    // Stage 3: Reel 2 (center) locked & final outcome
    const winnings = calcWin(reels, amount);

    if (winnings > 0) {
      const net = winnings - amount;
      const paid = db.payWin(message.author.id, net);
      const gross = amount + paid;
      await initialMsg.edit(
        renderSlotsFrame(REELS[reels[0]], REELS[reels[1]], REELS[reels[2]], betStr, `  and won ${currency} ${gross.toLocaleString()}`)
      ).catch(() => {});
    } else {
      db.addBalance(message.author.id, -amount);
      db.addGambled(message.author.id, amount);
      const refund = db.getInsuranceRefund(message.author.id, amount);
      if (refund > 0) {
        db.addBalance(message.author.id, refund);
      }
      await initialMsg.edit(
        renderSlotsFrame(REELS[reels[0]], REELS[reels[1]], REELS[reels[2]], betStr, `  and lost it all... :c`)
      ).catch(() => {});
    }
  },
};
