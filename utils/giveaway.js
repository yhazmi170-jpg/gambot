// Pure giveaway helpers (no Discord / no DB) so the draw + payout math is unit-testable.

/**
 * Draw `winnerCount` unique winners from `entries` without replacement.
 * Draws fewer if there are fewer entries than requested.
 * @param {string[]} entries
 * @param {number} winnerCount
 * @param {() => number} [rng] injectable RNG (defaults to Math.random)
 * @returns {string[]} unique winner ids
 */
function drawWinners(entries, winnerCount, rng = Math.random) {
  const pool = [...(entries || [])];
  const winners = [];
  const drawCount = Math.min(Math.max(1, Number(winnerCount) || 1), pool.length);
  for (let k = 0; k < drawCount; k++) {
    const idx = Math.floor(rng() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

/**
 * Compute the per-winner payout and the host refund for a resolved giveaway.
 * - split: the pot is divided across the actual winners; leftover cents refund the host.
 * - full: every winner gets the whole prize; unused winner slots refund the host.
 * @param {number} prize total prize (split) or per-winner prize (full)
 * @param {number} winnerCount configured winner slots
 * @param {'split'|'full'} mode
 * @param {number} actualWinners number of winners actually drawn
 */
function computePayout(prize, winnerCount, mode, actualWinners) {
  const m = mode === 'full' ? 'full' : 'split';
  const slots = Math.max(1, Number(winnerCount) || 1);
  const n = Math.max(0, Number(actualWinners) || 0);
  if (m === 'full') {
    const perWinner = Number(prize) || 0;
    const refund = perWinner * (slots - n);
    return { mode: m, perWinner, refund: Math.max(0, refund) };
  }
  const perWinner = n > 0 ? Math.floor((Number(prize) || 0) / n) : 0;
  const refund = (Number(prize) || 0) - perWinner * n;
  return { mode: m, perWinner, refund: Math.max(0, refund) };
}

/**
 * Per-winner prizer shown in announcements: split -> per-winner split amount,
 * full -> the whole prize beside every winner.
 */
function shownPayout(mode, perWinner, prize) {
  return mode === 'full' ? prize : perWinner;
}

/**
 * One line per actual winner: `<@id> — **amount** currency`.
 * Never @everyone/@here.
 * @param {string[]} winners
 * @param {'split'|'full'} mode
 * @param {number} perWinner
 * @param {number} prize
 * @param {string} currency
 */
function winnerLines(winners, mode, perWinner, prize, currency) {
  const shown = shownPayout(mode, perWinner, prize);
  return (winners || []).map(w => `<@${w}> — **${shown.toLocaleString()}** ${currency}`);
}

/**
 * Build the SINGLE channel announcement for a resolved giveaway.
 * - 1 winner  -> compact singular wording
 * - N winners -> one combined message listing EVERY winner + their payout
 * Falls back to a compressed winner list (same single message, every winner,
 * payout noted once) if the full per-winner lines would exceed Discord's
 * 2000-char message limit.
 * @param {string[]} winners
 * @param {'split'|'full'} mode
 * @param {number} perWinner
 * @param {number} prize
 * @param {string} currency
 */
function formatAnnouncement(winners, mode, perWinner, prize, currency) {
  const list = winners || [];
  if (!list.length) return '';
  if (list.length === 1) {
    return `🎉 <@${list[0]}> won the giveaway — **${shownPayout(mode, perWinner, prize).toLocaleString()}** ${currency}! Claim it in \`v inbox\`.`;
  }
  const full = `🎉 **Giveaway Winners**\n\n${winnerLines(list, mode, perWinner, prize, currency).join('\n')}\n\nClaim your prizes in \`v inbox\`.`;
  if (full.length <= 2000) return full;
  const compressed = `🎉 **Giveaway Winners** — **${shownPayout(mode, perWinner, prize).toLocaleString()}** ${currency} each\n\n${list.map(w => `<@${w}>`).join(' ')}\n\nClaim your prizes in \`v inbox\`.`;
  return compressed;
}

module.exports = { drawWinners, computePayout, winnerLines, formatAnnouncement };
