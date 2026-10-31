const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'sell',
  helpCategory: 'Pets',
  helpArgs: '<id|species|rarity|all> [count] | weapons <rarity|all> [count]',
  description: 'sell animals or weapons for coins',
  execute(message, args) {
    const userId = message.author.id;
    const raw = args[0];
    if (!raw) return message.channel.send({ embeds: [error('usage: `v sell <id>` · `v sell <species|rarity> [count]` · `v sell weapons <rarity|all> [count]`')] });

    const q = raw.toLowerCase();
    const isWeaponQuery = ['weapon', 'weapons', 'wep', 'weps'].includes(q);

    if (isWeaponQuery) {
      const target = (args[1] || '').toLowerCase();
      if (!target) {
        return message.channel.send({
          embeds: [error('usage: `v sell weapon <id>` · `v sell weapons <rarity|all> [count]`\n\nrarities: common · uncommon · rare · epic · mythical · legendary · fabled\nequipped weapons on pets are always skipped')],
        });
      }
      const id = parseInt(target, 10);
      if (!isNaN(id) && target === String(id)) {
        const res = db.sellWeapon(id, userId);
        if (!res.ok) {
          return message.channel.send({ embeds: [error(res.reason === 'notfound' ? 'weapon not found' : "that weapon isn't yours")] });
        }
        const tag = db.WEAPON_RARITY_TAG[res.weapon.rarity] || '⬜';
        return message.channel.send({
          embeds: [embed('Sold Weapon', [
            ['Weapon', `${tag} ${res.weapon.emoji} **${res.weapon.name}** (\`#${res.weapon.id}\` · ${res.weapon.rarity} · ${res.weapon.quality}%)`],
            ['Price', `**${res.price.toLocaleString()}** ${config.currency}`],
            ['Balance', `**${db.getBalance(userId).toLocaleString()}** ${config.currency}`],
          ], 0x57f287)],
        });
      }

      const count = args[2] ? parseInt(args[2], 10) : null;
      if (count && isNaN(count)) return message.channel.send({ embeds: [error('usage: `v sell weapons <rarity|all> [count]`')] });

      const res = db.sellWeapons(userId, target, count);
      if (!res.sold) {
        let msg = `no weapons matched \`${args[1]}\``;
        if (res.skipped > 0) msg += ` — ${res.skipped} matched weapon(s) are equipped on pets and were skipped`;
        return message.channel.send({ embeds: [error(msg)] });
      }

      const lines = [
        `sold **${res.sold}** weapon(s) for **${res.coins.toLocaleString()}** ${config.currency}`,
        `balance: **${db.getBalance(userId).toLocaleString()}** ${config.currency}`,
      ];
      if (res.skipped > 0) lines.push(`${res.skipped} equipped weapon(s) were skipped`);
      return message.channel.send({ embeds: [success(lines.join('\n'))] });
    }

    const id = parseInt(raw, 10);

    if (!isNaN(id) && raw === String(id)) {
      const animal = db.getAnimal(id);
      if (animal && animal.user_id === userId) {
        const price = db.sellPrice(animal);
        const team = db.getTeam(userId);
        const onTeam = team && (team.slot1 === animal.id || team.slot2 === animal.id || team.slot3 === animal.id);
        if (onTeam) {
          const s = [1, 2, 3].find(sl => team[`slot${sl}`] === animal.id);
          if (s) db.removeFromTeam(userId, s);
        }
        db.removeAnimal(id);
        db.addBalance(userId, price);
        return message.channel.send({
          embeds: [embed('Sold', [
            ['Animal', `**${animal.species}** (Lv.${animal.level})`],
            ['Price', `**${price.toLocaleString()}** ${config.currency}`],
          ], 0x57f287)],
        });
      }

      // Check if it's a weapon owned by the user
      const weapon = db.getWeapon(id);
      if (weapon && String(weapon.user_id) === String(userId)) {
        const res = db.sellWeapon(id, userId);
        const tag = db.WEAPON_RARITY_TAG[res.weapon.rarity] || '⬜';
        return message.channel.send({
          embeds: [embed('Sold Weapon', [
            ['Weapon', `${tag} ${res.weapon.emoji} **${res.weapon.name}** (\`#${res.weapon.id}\` · ${res.weapon.rarity} · ${res.weapon.quality}%)`],
            ['Price', `**${res.price.toLocaleString()}** ${config.currency}`],
            ['Balance', `**${db.getBalance(userId).toLocaleString()}** ${config.currency}`],
          ], 0x57f287)],
        });
      }

      return message.channel.send({ embeds: [error('animal or weapon not found')] });
    }

    const query = raw.toLowerCase();
    const count = args[1] ? parseInt(args[1], 10) : null;
    if (count && isNaN(count)) return message.channel.send({ embeds: [error('usage: `v sell <species|rarity> [count]`')] });

    const animals = db.getUserAnimals(userId);
    const team = db.getTeam(userId);
    const teamIds = team ? new Set([team.slot1, team.slot2, team.slot3].filter(Boolean)) : new Set();
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const matches = animals.filter(a => {
      if (query === 'all') return true;
      if (rarities.includes(query)) return a.rarity === query;
      return a.species.toLowerCase() === query || a.species.toLowerCase().startsWith(query);
    });
    const targets = count ? matches.slice(0, count) : matches;

    let sold = 0;
    let coins = 0;
    let skipped = 0;
    for (const a of targets) {
      if (teamIds.has(a.id)) { skipped++; continue; }
      coins += db.sellPrice(a);
      db.removeAnimal(a.id);
      sold++;
    }

    if (!sold) {
      let msg = `no animals matched \`${raw}\``;
      if (skipped > 0) msg += ` — ${skipped} matched animal(s) are on your battle team and were skipped`;
      return message.channel.send({ embeds: [error(msg)] });
    }

    db.addBalance(userId, coins);
    const lines = [`sold **${sold}** animal(s) for **${coins.toLocaleString()}** ${config.currency}`, `balance: **${db.getBalance(userId).toLocaleString()}** ${config.currency}`];
    if (skipped > 0) lines.push(`${skipped} team animal(s) were skipped`);
    message.channel.send({ embeds: [success(lines.join('\n'))] });
  },
};
