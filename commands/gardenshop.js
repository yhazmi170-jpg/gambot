const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'gardenshop',
  helpCategory: 'Pets',
  helpArgs: '',
  aliases: ['gshop'],
  description: 'garden upgrades — permanent boosts for your snail garden',
  execute(message, args) {
    const g = db.getGardenProfile(message.author.id);
    const fields = [];
    for (const [k, def] of Object.entries(db.GARDEN_UPGRADES)) {
      const owned = g.unlocks[k] || 0;
      const price = owned >= def.maxLevel
        ? 'MAXED'
        : (g.level < def.unlockLevel ? `🔒 level ${def.unlockLevel}` : `${def.costPerLevel(owned + 1).toLocaleString()} coins`);
      fields.push([`${def.emoji} ${def.name}`, `Lv **${owned}/${def.maxLevel}** — ${price}\n${def.desc}\nbuy: \`v gardenbuy ${k}\``]);
    }
    fields.push(['Your level', `**${g.level}** (${g.xp.toLocaleString()} xp)`]);

    message.channel.send({ embeds: [embed('🏪 Garden Shop', fields, 0x2b2d31)] });
  },
};