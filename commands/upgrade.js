const db = require('../db');
const { success, error } = require('../utils/embed');

const TRAITS = {
  efficiency: { name: 'Efficiency', effect: l => `more rare+ animals while hunting` },
  gain: { name: 'Gain', effect: l => `+${l * 2} coins per animal` },
  radar: { name: 'Radar', effect: l => `+${l * 50}% gem drop chance` },
  experience: { name: 'Experience', effect: l => `+${2 + l * 2} xp per animal` },
};

const ALIASES = {
  eff: 'efficiency',
  efficiency: 'efficiency',
  gain: 'gain',
  radar: 'radar',
  exp: 'experience',
  xp: 'experience',
  experience: 'experience',
};

module.exports = {
  name: 'upgrade',
  helpCategory: 'Pets',
  helpArgs: '<trait> [count]',
  aliases: ['upg'],
  description: 'spend essence to upgrade hunt traits (efficiency/gain/radar/experience)',
  execute(message, args) {
    const userId = message.author.id;
    const trait = ALIASES[(args[0] || '').toLowerCase()];
    if (!trait) {
      const list = Object.entries(TRAITS).map(([k, t]) => `\`${k}\` — ${t.effect(1)}`).join('\n');
      return message.channel.send({ embeds: [error(`usage: \`v upgrade <trait> [count]\`\n\n${list}\n\nupgrading costs essence — get it with \`v sacrifice\``)] });
    }

    let count = 1;
    if (args[1]) {
      const n = parseInt(args[1], 10);
      if (!isNaN(n) && n > 0) count = Math.min(n, 50);
    }

    const t = TRAITS[trait];
    let level = db.getTraits(userId)[trait];
    let done = 0;
    let spent = 0;
    for (let i = 0; i < count; i++) {
      const r = db.upgradeTrait(userId, trait);
      if (!r || !r.ok) break;
      spent += r.cost;
      done++;
      level = r.level;
    }

    if (!done) {
      return message.channel.send({ embeds: [error(`not enough essence — **${t.name}** is level ${level}, next costs **${db.traitCost(level)}** essence (you have **${db.getEssence(userId)}**)`) ] });
    }

    const next = db.traitCost(level);
    message.channel.send({ embeds: [success(`**${t.name}** upgraded to **level ${level}** (${done} level${done > 1 ? 's' : ''}) — spent **${spent}** essence\n${t.effect(level)}\nnext level: **${next}** essence\nyou have **${db.getEssence(userId)}** left`)] });
  },
};
