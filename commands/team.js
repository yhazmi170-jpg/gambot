const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'team',
  aliases: ['t'],
  description: 'manage your battle team (up to 3 animals)',
  async execute(message, args) {
    const userId = message.author.id;
    const sub = args[0];

    if (!sub || sub === 'view') {
      const team = db.getTeam(userId);
      if (!team || (!team.slot1 && !team.slot2 && !team.slot3)) {
        return message.channel.send({ embeds: [require('../utils/embed').error('your team is empty — use `v team add <id>` to add animals')] });
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
      const id = parseInt(args[1]);
      if (!id) return message.channel.send({ embeds: [require('../utils/embed').error('usage: `v team add <animal id>`')] });
      const animal = db.getAnimal(id);
      if (!animal || animal.user_id !== userId) return message.channel.send({ embeds: [require('../utils/embed').error('animal not found')] });

      const team = db.getTeam(userId);
      const used = [team?.slot1, team?.slot2, team?.slot3].filter(Boolean);
      if (used.length >= 3) return message.channel.send({ embeds: [require('../utils/embed').error('team is full — remove one first with `v team remove <slot>`')] });
      if (used.includes(id)) return message.channel.send({ embeds: [require('../utils/embed').error('that animal is already on your team')] });

      const slot = [1, 2, 3].find(s => !team || !team[`slot${s}`]);
      db.setTeam(userId, slot, id);
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
