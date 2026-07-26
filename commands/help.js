const fs = require('fs');
const path = require('path');
const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

const prefix = config.prefixes[0];

const perkCmdMap = {
  rob: `\`${prefix} rob <@user>\` — 50/50 robbery`,
  profile: `\`${prefix} profile\` — view stats`,
  rain: `\`${prefix} rain <amount>\` — rain money to all`,
  duel: `\`${prefix} duel <@user> <amount>\` — 1v1 challenge`,
  rep: `\`${prefix} rep <@user>\` — give reputation`,
};

const CATEGORY_ORDER = ['Economy', 'Games', 'Pets', 'Social', 'Shop'];

module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'cmds'],
  execute(message, args) {
    const uid = message.author.id;
    const owned = db.getUserPerks(uid).map(p => p.perk);
    const perkLines = Object.entries(perkCmdMap).filter(([k]) => owned.includes(k)).map(([, v]) => v);

    const cmdsByCat = {};
    const dir = path.join(__dirname);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'help.js');
    for (const file of files) {
      const cmd = require(path.join(dir, file));
      if (cmd.helpCategory) {
        if (!cmdsByCat[cmd.helpCategory]) cmdsByCat[cmd.helpCategory] = [];
        const displayName = cmd.aliases && cmd.aliases.length ? cmd.aliases[0] : cmd.name;
        cmdsByCat[cmd.helpCategory].push(`\`${prefix} ${displayName}${cmd.helpArgs ? ' ' + cmd.helpArgs : ''}\` — ${cmd.description || displayName}`);
      }
    }

    const sections = [];
    for (const cat of CATEGORY_ORDER) {
      if (cmdsByCat[cat]) sections.push([cat, cmdsByCat[cat].join('\n')]);
    }
    for (const cat of Object.keys(cmdsByCat)) {
      if (!CATEGORY_ORDER.includes(cat)) sections.push([cat, cmdsByCat[cat].join('\n')]);
    }

    if (perkLines.length) {
      sections.push(['Your Perk Commands', perkLines.join('\n')]);
    }

    message.channel.send({
      embeds: [embed('🎰 Gambot', sections)],
    });
  },
};