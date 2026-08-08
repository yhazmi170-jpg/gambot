const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

const CHECKLIST_LABELS = {
  hunt: 'hunt animals',
  battle: 'win battles',
  eggs: 'hatch eggs',
  gamble: 'gamble coins',
  gems: 'gain gems',
};

const CHECKLIST_EMOJI = {
  hunt: '🎯',
  battle: '⚔️',
  eggs: '🥚',
  gamble: '🎰',
  gems: '💎',
};

const CHECKLIST_ORDER = ['hunt', 'battle', 'eggs', 'gamble', 'gems'];

function bar(pct) {
  const filled = Math.min(10, Math.floor(pct / 10));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

module.exports = {
  name: 'checklist',
  helpCategory: 'Economy',
  helpArgs: '[weekly|claim]',
  description: 'multi-task daily + weekly checklists — complete all tasks for coins + seals',
  aliases: ['check', 'cl'],
  execute(message, args) {
    const userId = message.author.id;
    const cmd = (args[0] || '').toLowerCase();

    if (cmd === 'weekly' || cmd === 'w' || cmd === 'week') {
      const sub = (args[1] || '').toLowerCase();
      if (sub === 'claim') return claim(message, userId, 'weekly');
      return show(message, userId, 'weekly');
    }
    if (cmd === 'claim') return claim(message, userId, 'daily');
    return show(message, userId, 'daily');
  },
};

function claim(message, userId, period) {
  const r = db.claimChecklist(userId, period);
  if (!r) {
    const c = db.getChecklist(userId, period);
    return message.channel.send({ embeds: [error(c.claimed ? `you already claimed the ${period} checklist!` : `not all ${period} tasks done yet — finish them first`)] });
  }
  const label = period === 'weekly' ? 'Weekly' : 'Daily';
  return message.channel.send({ embeds: [success(`${label} checklist complete! claimed **${r.reward.toLocaleString()}** ${config.currency} + **${r.seals}** seal${r.seals > 1 ? 's' : ''}`)] });
}

function show(message, userId, period) {
  const c = db.getChecklist(userId, period);
  const lines = [];
  for (const key of CHECKLIST_ORDER) {
    const prog = c.progress[key] || 0;
    const target = c.tasks[key];
    const pct = Math.min(100, Math.floor((prog / target) * 100));
    lines.push(`${CHECKLIST_EMOJI[key]} **${prog.toLocaleString()}/${target.toLocaleString()}** ${CHECKLIST_LABELS[key]}\n${bar(pct)} **${pct}%**`);
  }
  const title = period === 'weekly' ? '🗓️ Weekly Checklist' : '📋 Daily Checklist';
  const fields = [
    ['Tasks', lines.join('\n\n')],
    ['Reward', `**${c.reward.toLocaleString()}** ${config.currency} + **${c.seals}** seal${c.seals > 1 ? 's' : ''}`],
  ];
  if (c.claimed) fields.push(['', `claimed for this period — come back next ${period === 'weekly' ? 'week' : 'day'}!`]);
  else fields.push(['', c.allDone ? `\`v checklist claim\` to collect!` : `complete all tasks to claim • \`v checklist ${period === 'weekly' ? 'weekly claim' : 'claim'}\``]);
  const pctAll = Math.round(CHECKLIST_ORDER.reduce((s, k) => s + Math.min(100, ((c.progress[k] || 0) / c.tasks[k]) * 100), 0) / CHECKLIST_ORDER.length);
  return message.channel.send({ embeds: [embed(title, fields, 0x57f287).setFooter({ text: `${pctAll}% complete` })] });
}