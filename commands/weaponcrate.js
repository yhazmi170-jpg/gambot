const db = require('../db');
const { embed, error } = require('../utils/embed');

module.exports = {
  name: 'weaponcrate',
  helpCategory: 'Pets',
  helpArgs: '[buy|open [count|all]]',
  description: 'buy or open a weapon crate — weapons you can equip on your team',
  aliases: ['wcrate', 'wepcrate', 'wc'],
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
      let qty = 1;
      const qArg = (args[1] || '').toLowerCase();
      if (qArg === 'all') qty = crates;
      else if (qArg !== '') {
        const parsed = Number(args[1]);
        if (!Number.isInteger(parsed) || parsed < 1) {
          return message.channel.send({ embeds: [error('invalid crate count — use `v weaponcrate open`, `v weaponcrate open <count>`, or `v weaponcrate open all`')] });
        }
        if (parsed > crates) {
          return message.channel.send({ embeds: [error(`you only have **${crates}** weapon crate${crates === 1 ? '' : 's'} — can't open ${parsed}`)] });
        }
        qty = parsed;
      }
      const res = db.openWeaponCrates(userId, qty);
      if (!res.ok) return message.channel.send({ embeds: [error('you have no weapon crates — buy one with `v weaponcrate buy`')] });
      if (res.opened.length === 1) {
        const w = res.opened[0];
        const tag = db.WEAPON_RARITY_TAG[w.rarity] || '⬜';
        return message.channel.send({ embeds: [embed(`${tag} ${w.rarity.toUpperCase()} WEAPON`, [
          ['You got', `${w.emoji} **${w.name}** (${w.rarity})\nquality **${w.quality}%** · ATK **+${w.atk}** · DEF **+${w.def}**\nID \`#${w.id}\``],
          ['Effect', w.desc],
          ['Equip', 'it only works on your battle team — `v team add` a pet, then `v weapon equip #<weaponId> #<animalId>`'],
          ['', `\`${res.cratesLeft}\` crate${res.cratesLeft === 1 ? '' : 's'} left`],
        ], w.rarity === 'fabled' || w.rarity === 'legendary' ? 0xffd700 : 0x5865f2)] });
      }
      const lines = res.opened.map(w => `#${w.id} ${w.emoji} **${w.name}** — ${w.rarity} · ${w.quality}%`);
      const anyLegendary = res.opened.some(w => w.rarity === 'fabled' || w.rarity === 'legendary');
      return message.channel.send({ embeds: [embed(`📦 Opened ${res.opened.length} Weapon Crate${res.opened.length > 1 ? 's' : ''}`, [
        ['Drops', lines.join('\n')],
        ['Crates left', `**${res.cratesLeft}**`],
        ['Effects/Equip', 'see each weapon\u2019s effect with `v weapon list` · equip on a battle team pet with `v weapon equip #<weaponId> #<animalId>`'],
      ], anyLegendary ? 0xffd700 : 0x5865f2)] });
    }

    // default: show status
    const crates = db.getWeaponCrates(userId);
    const list = db.getWeaponInv(userId);
    return message.channel.send({ embeds: [embed('🏴‍☠️ Weapon Crates', [
      ['Crates', `you have **${crates}** weapon crate${crates === 1 ? '' : 's'}`],
      ['Buy', `\`v weaponcrate buy\` — **${db.WEAPON_CRATE_PRICE.toLocaleString()}** coins`],
      ['Open', `\`v weaponcrate open\` — open [count|all] — one, a few, or all`],
      ['Your weapons', list.length ? `you own **${list.length}** weapon${list.length === 1 ? '' : 's'} — see them with \`v weapon list\`` : 'none yet — buy a crate!'],
    ], 0x2b2d31)] });
  },
};
