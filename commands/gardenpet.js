const db = require('../db');
const { embed, success, error } = require('../utils/embed');

module.exports = {
  name: 'gardenpet',
  helpCategory: 'Pets',
  helpArgs: '[runner]',
  aliases: ['gp'],
  description: 'garden runners — pick which pet plants your snail garden',
  execute(message, args) {
    const userId = message.author.id;
    const g = db.getGardenProfile(userId);
    const wanted = (args[0] || '').toLowerCase();

    if (wanted) {
      const def = db.GARDEN_RUNNERS[wanted];
      if (!def) return message.channel.send({ embeds: [error('unknown runner — see `v gardenpet`')] });
      const res = db.equipGardenRunner(userId, wanted);
      if (!res.ok) {
        if (res.reason === 'locked') return message.channel.send({ embeds: [error(`${def.emoji} **${def.name}** unlocks at garden level **${res.needed}** (you're level **${res.level}**)`)] });
        return message.channel.send({ embeds: [error('unknown runner')] });
      }
      return message.channel.send({ embeds: [success(`${res.runner.emoji} **${res.runner.name}** is now planting your garden!\n${res.runner.desc}`)] });
    }

    const equipped = db.GARDEN_RUNNERS[g.runner] || db.GARDEN_RUNNERS.snail;
    const fields = [];
    let count = 0;
    for (const [k, r] of Object.entries(db.GARDEN_RUNNERS)) {
      const owned = db.isGardenRunnerUnlocked(userId, k);
      if (owned) count++;
      const status = owned ? (k === g.runner ? 'equipped ✅' : 'unlocked') : `🔒 level ${r.unlockLevel}`;
      fields.push([`${r.emoji} ${r.name}`, `${status}\n${r.desc}`]);
    }
    fields.unshift(['Equipped', `${equipped.emoji} **${equipped.name}**`]);
    fields.push(['Unlocked', `**${count}** / ${Object.keys(db.GARDEN_RUNNERS).length}`]);

    message.channel.send({ embeds: [embed('🏡 Garden Runners', fields, 0x2b2d31)] });
  },
};