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

module.exports = { drawWinners, computePayout };
