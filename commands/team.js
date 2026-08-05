const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'team',
  helpCategory: 'Pets',
  helpArgs: '<slot> <id or species>',
  aliases: ['t'],
  description: 'manage your battle team (up to 3 animals)',  async execute(message, args) {
    const userId = message.author.id;
    const sub = args[0];

    if (!sub || sub === 'view') {
      const team = db.getTeam(userId);
      if (!team || (!team.slot1 && !team.slot2 && !team.slot3)) {
        return message.channel.send({ embeds: [require('../utils/embed').error('your team is empty — use `v team add <species>` to add animals')] });
      }
      const rarityEmojis = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
      const lines = [];
      for (let i = 1; i <= 3; i++) {
        const id = team[`slot${i}`];
        if (id) {
          const a = db.getAnimal(id);
          if (a) lines.push(`**Slot ${i}:** ${rarityEmojis[a.rarity]} **${a.species}** Lv.${a.level} ❤️${a.hp} ⚔️${a.attack} 🛡️${a.defense}`);
          else lines.push(`**Slot ${i}:** empty`);
        } else {
          lines.push(`**Slot ${i}:** empty`);
        }
      }
      return message.channel.send({
        embeds: [embed('⭐ Battle Team', [[`${message.author.username}'s team`, lines.join('\n')]], 0xfee75c)],
      });
    }

    if (sub === 'add') {
      const arg = args[1];
      if (!arg) return message.channel.send({ embeds: [require('../utils/embed').error('usage: `v team add <id or species>`')] });

      let animal;
      const asNum = parseInt(arg);
      if (asNum) {
        animal = db.getAnimal(asNum);
        if (!animal || animal.user_id !== userId) animal = null;
      }
      if (!animal) {
        const mine = db.getUserAnimals(userId);
        const q = arg.toLowerCase();
        const matches = mine.filter(a => a.species.toLowerCase() === q || (a.name || '').toLowerCase() === q);
        if (matches.length > 1) {
          return message.channel.send({ embeds: [require('../utils/embed').error(`you have ${matches.length} of that — use the \`#id\` from \`v zoo\` to pick one (e.g. \`v team add ${matches[0].id}\`)`)] });
        }
        animal = matches[0];
      }
      if (!animal) return message.channel.send({ embeds: [require('../utils/embed').error('animal not found — check `v zoo`')] });

      const team = db.getTeam(userId);
      const used = [team?.slot1, team?.slot2, team?.slot3].filter(Boolean);
      if (used.length >= 3) return message.channel.send({ embeds: [require('../utils/embed').error('team is full — remove one first with `v team remove <slot>`')] });
      if (used.includes(animal.id)) return message.channel.send({ embeds: [require('../utils/embed').error('that animal is already on your team')] });

      const slot = [1, 2, 3].find(s => !team || !team[`slot${s}`]);
      db.setTeam(userId, slot, animal.id);
      return message.channel.send({ embeds: [embed('✅ Team Update', [[`${animal.species}`, `added to slot ${slot}`]], 0x57f287)] });
    }

    if (sub === 'remove') {
      const slot = parseInt(args[1]);
      if (!slot || slot < 1 || slot > 3) return message.channel.send({ embeds: [require('../utils/embed').error('usage: `v team remove <1-3>`')] });
      db.removeFromTeam(userId, slot);
      return message.channel.send({ embeds: [embed('✅ Team Update', [[`slot ${slot}`, 'cleared']], 0x57f287)] });
    }
  },
};
