const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function tierRewardsText(track) {
  const lines = [];
  for (let lvl = 1; lvl <= db.PASS_MAX_LEVEL; lvl++) {
    const r = db.passReward(lvl, track === 'premium');
    const parts = [`${r.coins.toLocaleString()}`];
    if (r.gems) parts.push(`${r.gems}💎`);
    if (r.seals) parts.push(`${r.seals}🎫`);
    lines.push(`Lvl ${lvl}: ${parts.join(' + ')}`);
  }
  return lines;
}

function progressBar(pct, len = 10) {
  const filled = Math.min(len, Math.floor((pct / 100) * len));
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

module.exports = {
  name: 'battlepass',
  helpCategory: 'Economy',
  helpArgs: '[buy|claim|top|rewards]',
  aliases: ['pass', 'bp', 'season'],
  description: 'seasonal battle pass — earn XP, level up, claim free + premium rewards',
  execute(message, args) {
    const userId = message.author.id;
    const cmd = (args[0] || '').toLowerCase();

    if (cmd === 'buy') return buy(message, userId);
    if (cmd === 'claim') return claim(message, userId);
    if (cmd === 'top' || cmd === 'leaderboard' || cmd === 'lb') return top(message, userId);
    if (cmd === 'rewards' || cmd === 'shop') return rewards(message);
    return show(message, userId);
  },
};

function show(message, userId) {
  const prog = db.passProgress(userId);
  const pct = prog.need > 0 ? Math.min(100, Math.floor((prog.into / prog.need) * 100)) : 100;

  const freeNext = Math.min(prog.level + 1, prog.maxLevel);
  const premNext = freeNext;
  const freeR = db.passReward(freeNext, false);
  const premR = db.passReward(premNext, true);

  const claimableFree = [];
  const claimablePrem = [];
  for (let l = 1; l <= prog.level; l++) {
    if (!prog.freeClaimed.includes(l)) claimableFree.push(l);
    if (prog.premium && !prog.premClaimed.includes(l)) claimablePrem.push(l);
  }

  const trackLines = [];
  trackLines.push(`**FREE TRACK** ${prog.level >= prog.maxLevel ? '✅ MAX' : ''}`);
  trackLines.push(`${progressBar(pct)} **${prog.into}/${prog.need} XP** (${pct}%)`);
  trackLines.push(`Level **${prog.level}** / ${prog.maxLevel}`);
  if (claimableFree.length) trackLines.push(`🔓 ${claimableFree.length} unclaimed — \`v bp claim\``);

  if (prog.premium) {
    trackLines.push('');
    trackLines.push(`**PREMIUM TRACK** ⭐`);
    if (claimablePrem.length) trackLines.push(`🔓 ${claimablePrem.length} unclaimed — \`v bp claim\``);
    else trackLines.push('all caught up!');
  } else {
    trackLines.push('');
    trackLines.push(`⭐ **PREMIUM** — unlock with \`v bp buy\` (**${db.PASS_PREM_COST} seals**)`);
  }

  return message.channel.send({
    embeds: [embed(`🏆 Season ${prog.season} — Battle Pass`, [
      ['Progress', trackLines.join('\n')],
      ['Next free (Lvl ' + freeNext + ')', `${freeR.coins.toLocaleString()}` + (freeR.seals ? ` + ${freeR.seals}🎫` : '')],
      ['Next ⭐ (Lvl ' + premNext + ')', `${premR.coins.toLocaleString()}` + (premR.gems ? ` + ${premR.gems}💎` : '') + (premR.seals ? ` + ${premR.seals}🎫` : '')],
      ['Season ends', fmtTime(prog.endsAt - Math.floor(Date.now() / 1000))],
    ], 0xaa7bff).setFooter({ text: `v bp rewards · v bp top · v bp claim` })],
  });
}

function rewards(message) {
  const free = tierRewardsText('free');
  const prem = tierRewardsText('premium');
  const freeChunks = [];
  for (let i = 0; i < free.length; i += 10) freeChunks.push(free.slice(i, i + 10).join('\n'));
  const premChunks = [];
  for (let i = 0; i < prem.length; i += 10) premChunks.push(prem.slice(i, i + 10).join('\n'));

  const e = embed(`🏆 Season Rewards — all ${db.PASS_MAX_LEVEL} tiers`, [], 0xaa7bff);
  freeChunks.forEach((c, i) => e.addFields({ name: i === 0 ? 'Free Track' : 'Free (cont.)', value: c }));
  premChunks.forEach((c, i) => e.addFields({ name: i === 0 ? '⭐ Premium Track' : '⭐ Premium (cont.)', value: c }));
  e.addFields({ name: 'Unlock premium', value: `\`v bp buy\` — ${db.PASS_PREM_COST} seals` });
  return message.channel.send({ embeds: [e] });
}

function buy(message, userId) {
  const seals = db.getSeals(userId);
  const res = db.buyPassPremium(userId);
  if (!res.ok) {
    if (res.reason === 'owned') return message.channel.send({ embeds: [error('you already own the premium track this season!')] });
    return message.channel.send({ embeds: [error(`not enough seals — need **${db.PASS_PREM_COST}**, you have **${seals}**. earn seals via daily/weekly checklists & premium pass tiers`)] });
  }
  return message.channel.send({ embeds: [success(`⭐ premium track unlocked for **${db.PASS_PREM_COST}** seals! \`v bp\` to see your rewards, \`v bp claim\` to collect`)] });
}

function claim(message, userId) {
  const claimed = db.claimAllPass(userId);
  if (!claimed.length) {
    const prog = db.passProgress(userId);
    if (prog.level === 0) return message.channel.send({ embeds: [error('no rewards to claim yet — earn some XP first!')] });
    return message.channel.send({ embeds: [error('all rewards already claimed — level up for more!')] });
  }
  let totalCoins = 0, totalGems = 0, totalSeals = 0;
  for (const c of claimed) {
    totalCoins += c.coins || 0;
    totalGems += c.gems || 0;
    totalSeals += c.seals || 0;
  }
  const parts = [`**${totalCoins.toLocaleString()}** ${config.currency}`];
  if (totalGems) parts.push(`**${totalGems}** 💎`);
  if (totalSeals) parts.push(`**${totalSeals}** 🎫 seals`);
  const detail = claimed.slice(0, 6).map(c => `Lvl ${c.level} ${c.track === 'premium' ? '⭐' : 'free'}`).join(', ') + (claimed.length > 6 ? `, +${claimed.length - 6} more` : '');
  return message.channel.send({ embeds: [success(`claimed **${claimed.length}** reward tier${claimed.length > 1 ? 's' : ''}: ${parts.join(' + ')}\n${detail}`)] });
}

function top(message, userId) {
  const prog = db.passProgress(message.author.id);
  const top = db.passTop(10);
  if (!top.length) return message.channel.send({ embeds: [error('no pass XP earned this season yet — be the first!')] });
  const lines = top.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} <@${p.userId}> — Lvl **${p.level}** (${p.xp} XP)`;
  });
  return message.channel.send({
    embeds: [embed(`🏆 Season ${prog.season} — Top Pass Levels`, [
      ['Leaderboard', lines.join('\n')],
    ], 0xaa7bff).setFooter({ text: `Your level: ${prog.level} (${prog.xp} XP)` })],
  });
}
