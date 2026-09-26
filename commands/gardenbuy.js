const db = require('../db');
const { success, error } = require('../utils/embed');

module.exports = {
  name: 'gardenbuy',
  helpCategory: 'Pets',
  helpArgs: '<upgrade>',
  aliases: ['gbuy'],
  description: 'buy a garden upgrade — see `v gardenshop`',
  execute(message, args) {
    const item = (args[0] || '').toLowerCase();
    if (!item) return message.channel.send({ embeds: [error('usage: `v gardenbuy <upgrade>` — list them with `v gardenshop`')] });
    const def = db.GARDEN_UPGRADES[item];
    if (!def) return message.channel.send({ embeds: [error('unknown upgrade — see `v gardenshop`')] });
    const r = db.buyGardenUpgrade(message.author.id, item);
    if (!r.ok) {
      if (r.reason === 'level') return message.channel.send({ embeds: [error(`${def.emoji} **${def.name}** unlocks at garden level **${r.needed}** (you're level **${r.level}**)`)] });
      if (r.reason === 'max') return message.channel.send({ embeds: [error(`${def.emoji} **${def.name}** is already max level (**${r.maxLevel}**)`)] });
      if (r.reason === 'coins') return message.channel.send({ embeds: [error(`the next ${def.emoji} **${def.name}** level costs **${r.cost.toLocaleString()}** coins (you have **${r.balance.toLocaleString()}**)`)] });
      return message.channel.send({ embeds: [error('unknown upgrade')] });
    }
    return message.channel.send({ embeds: [success(`${def.emoji} **${def.name}** upgraded to level **${r.level}** for **${r.cost.toLocaleString()}** coins`)] });
  },
};