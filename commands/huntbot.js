const db = require('../db');
const { embed } = require('../utils/embed');

const TRAITS = {
  efficiency: { name: 'Efficiency', effect: l => `more rare+ animals` },
  gain: { name: 'Gain', effect: l => `+${l * 2} coins/animal` },
  radar: { name: 'Radar', effect: l => `+${l * 50}% gem drop chance` },
  experience: { name: 'Experience', effect: l => `+${2 + l * 2} xp/animal` },
};

function bar(percent, len = 10) {
  const filled = Math.round(Math.max(0, Math.min(percent, 1)) * len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}

module.exports = {
  name: 'huntbot',
  helpCategory: 'Pets',
  helpArgs: '',
  aliases: ['hb', 'huntpanel'],
  description: 'huntbot panel — essence, hunt traits, and the autohunt bot',
  execute(message, args) {
    const userId = message.author.id;
    try { db.catchUpAutohunt(userId); } catch (err) {}

    const user = db.ensureUser(userId);
    const traits = db.getTraits(userId);
    const y = db.huntYield(userId);
    const level = user ? user.autohunt_level : 0;
    const ah = db.getAutohunt(userId);
    const essence = user ? user.essence : 0;

    const fields = [];

    fields.push(['Hunt', `\`v hunt\` → **${y.capacity}** animal${y.capacity > 1 ? 's' : ''} (1 base + 1 per 5 gems)\ncost **${db.HUNT_COST_BASE * y.capacity}** coins${y.coins > 0 ? ` · **+${y.coins}** coins/animal (Gain)` : ''}${y.xp > 0 ? ` · **+${y.xp}** xp/animal` : ''}`]);

    fields.push(['Essence', `**${essence}**\n\`v sacrifice <species|rarity>\` to convert animals to essence\ncommon 1 · uncommon 3 · rare 8 · epic 25 · legendary 100`]);

    const maxMin = db.autohuntMaxMinutes(level);
    const ahStatus = ah ? `**running** — ${Math.ceil(db.getAutohuntProgress(userId).remaining / 60)}m left` : 'idle';
    fields.push(['Autohunt Bot', `**${db.autohuntRank(level)}** · level **${level}** · ${ahStatus}\n${db.autohuntAnimalsPerCycle(level)} animal(s)/min · max run **${maxMin}m**\n\`v autohunt <mins>\` to start · \`v autohuntbot\` to upgrade (**${db.autohuntUpgradeCost(level)}** essence)`]);

    for (const [key, t] of Object.entries(TRAITS)) {
      const l = traits[key];
      const cost = db.traitCost(l);
      const pct = cost > 0 ? Math.min(essence / cost, 1) : 1;
      fields.push([`${t.name} Lv.${l}`, `${t.effect(l)}\nnext: **${cost}** essence \`${bar(pct)}\`\n\`v upgrade ${key}\``]);
    }

    fields.push(['Snail Garden', '`v garden` to view and grow your snail garden']);

    message.channel.send({ embeds: [embed('Huntbot Panel', fields, 0x2b2d31)] });
  },
};
