const db = require('../db');
const { embed, error } = require('../utils/embed');

module.exports = {
  name: 'weaponcrate',
  helpCategory: 'Pets',
  helpArgs: '[buy|open]',
  description: 'buy or open a weapon crate — weapons you can equip on your team',
  aliases: ['wcrate', 'wepcrate'],
  execute(message, args) {
    const userId = message.author.id;
    const action = (args[0] || '').toLowerCase();

    if (action === 'buy') {
      const res = db.buyWeaponCrate(userId);
      if (!res.ok) return message.channel.send({ embeds: [error(`you need **${db.WEAPON_CRATE_PRICE.toLocaleString()}** coins to buy a weapon crate`)] });
      const crates = db.getWeaponCrates(userId);
      return message.channel.send({ embeds: [embed('🏴‍☠️ Weapon Crate', [['', `you bought a weapon crate for **${db.WEAPON_CRATE_PRICE.toLocaleString()}** coins — you now have **${crates}** crate${crates > 1 ? 's' : ''}\nrun \`v weaponcrate open\` to open one!`]], 0x5865f2)] });
    }

    if (action === 'open') {
      const crates = db.getWeaponCrates(userId);
      if (crates <= 0) {
        return message.channel.send({ embeds: [embed('🏴‍☠️ Weapon Crate', [
          ['', `you have **0** weapon crates — buy one with \`v weaponcrate buy\` (**${db.WEAPON_CRATE_PRICE.toLocaleString()}** coins)\nwin them from \`v battle\` and \`v hunt\` drops too!`],
        ], 0x5865f2)] });
      }
      const res = db.openWeaponCrate(userId);
      if (!res.ok) return message.channel.send({ embeds: [error('you have no weapon crates — buy one with `v weaponcrate buy`')] });
      const tag = db.WEAPON_RARITY_TAG[res.rarity] || '⬜';
      return message.channel.send({ embeds: [embed(`${tag} ${res.rarity.toUpperCase()} WEAPON`, [
        ['You got', `${res.emoji} **${res.name}** (${res.rarity})\nquality **${res.quality}%** · ATK **+${res.atk}** · DEF **+${res.def}**\nID \`#${res.id}\``],
        ['Effect', res.desc],
        ['Equip', 'it only works on your battle team — `v team add` a pet, then `v weapon equip #<weaponId> #<animalId>`'],
        ['', `\`${crates - 1}\` crate${crates - 1 === 1 ? '' : 's'} left`],
      ], res.rarity === 'fabled' || res.rarity === 'legendary' ? 0xffd700 : 0x5865f2)] });
    }

    // default: show status
    const crates = db.getWeaponCrates(userId);
    const list = db.getWeaponInv(userId);
    return message.channel.send({ embeds: [embed('🏴‍☠️ Weapon Crates', [
      ['Crates', `you have **${crates}** weapon crate${crates === 1 ? '' : 's'}`],
      ['Buy', `\`v weaponcrate buy\` — **${db.WEAPON_CRATE_PRICE.toLocaleString()}** coins`],
      ['Open', `\`v weaponcrate open\` — open one for a random weapon`],
      ['Your weapons', list.length ? `you own **${list.length}** weapon${list.length === 1 ? '' : 's'} — see them with \`v weapon list\`` : 'none yet — buy a crate!'],
    ], 0x2b2d31)] });
  },
};
