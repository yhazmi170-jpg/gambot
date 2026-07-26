const fs = require('fs');
const path = require('path');
const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');
const { version } = require('../package.json');

const prefix = config.prefixes[0];

const perkCmdMap = {
  rob: `\`${prefix} rob <@user>\` — 50/50 robbery`,
  profile: `\`${prefix} profile\` — view stats`,
  rain: `\`${prefix} rain <amount>\` — rain money to online members`,
  duel: `\`${prefix} duel <@user> <amount>\` — 1v1 coinflip`,
  rep: `\`${prefix} rep <@user>\` — give reputation`,
  vip_games: `\`${prefix} poker <amount>\` — video poker (VIP)`,
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
      delete require.cache[require.resolve(path.join(dir, file))];
      const cmd = require(path.join(dir, file));
      if (cmd.helpCategory) {
        if (!cmdsByCat[cmd.helpCategory]) cmdsByCat[cmd.helpCategory] = [];
        cmdsByCat[cmd.helpCategory].push({
          name: cmd.name,
          line: `\`${prefix} ${cmd.name}${cmd.helpArgs ? ' ' + cmd.helpArgs : ''}\` — ${cmd.description || cmd.name}`,
        });
      }
    }

    const sections = [];
    for (const cat of CATEGORY_ORDER) {
      if (!cmdsByCat[cat]) continue;
      const lines = cmdsByCat[cat].sort((a, b) => a.name.localeCompare(b.name)).map(c => c.line);
      sections.push([cat, lines.join('\n')]);
    }
    for (const cat of Object.keys(cmdsByCat)) {
      if (CATEGORY_ORDER.includes(cat)) continue;
      const lines = cmdsByCat[cat].sort((a, b) => a.name.localeCompare(b.name)).map(c => c.line);
      sections.push([cat, lines.join('\n')]);
    }

    if (perkLines.length) {
      sections.push(['Your Perk Commands', perkLines.join('\n')]);
    }

    sections.push(['Tips', [
      `\`${prefix} gamehelp <game>\` — rules for each game`,
      `\`${prefix} version\` — bot version (v${version})`,
      'Higher balance = slightly lower rewards/wins (caps at 30% less)',
    ].join('\n')]);

    message.channel.send({
      embeds: [embed(`Gambot v${version}`, sections)],
    });
  },
};
