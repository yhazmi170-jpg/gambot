const cooldowns = new Map();

const DEFAULTS = {
  slots: 3000,
  coinflip: 3000,
  cf: 3000,
  dice: 3000,
  roll: 3000,
  roulette: 3000,
  crash: 3000,
  give: 5000,
  pay: 5000,
  work: 3000,
  lottery: 2000,
  bal: 2000,
  lb: 3000,
  leaderboard: 3000,
};

function checkCooldown(userId, cmdName) {
  const now = Date.now();
  if (!cooldowns.has(userId)) cooldowns.set(userId, {});
  const user = cooldowns.get(userId);
  const cd = DEFAULTS[cmdName] || 2000;
  const last = user[cmdName] || 0;
  if (now - last < cd) return Math.ceil((cd - (now - last)) / 1000);
  user[cmdName] = now;
  return 0;
}

module.exports = { checkCooldown, DEFAULTS };
