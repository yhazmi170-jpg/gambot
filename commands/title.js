const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

const RARITY_TAG = { common: '▫️', rare: '🔷', legendary: '🌟', hidden: '❔' };

module.exports = {
  name: 'title',
  helpCategory: 'Social',
  helpArgs: '[equip <key> | clear | list]',
  description: 'collect + show off titles',
  aliases: ['titles', 'tit'],
  execute(message, args) {
    const cmd = (args[0] || '').toLowerCase();
    const userId = message.author.id;
    const owned = db.getTitles(userId);
    const equipped = db.getEquippedTitle(userId);

    if (cmd === 'equip') {
      const key = args[1] || '';
      if (!key) return message.channel.send({ embeds: [error('give a title key to equip — `v title equip <key>`')] });
      if (!db.TITLES[key]) return message.channel.send({ embeds: [error('no title with that key')] });
      const res = db.equipTitle(userId, key);
      if (!res.ok) return message.channel.send({ embeds: [error('u dont own that one yet')] });
      return message.channel.send({ embeds: [success(`equipped **${db.TITLES[key].name}** — it shows on ur profile`)] });
    }

    if (cmd === 'clear' || cmd === 'unequip' || cmd === 'remove') {
      db.clearTitle(userId);
      return message.channel.send({ embeds: [success('title cleared')] });
    }

    // full list: unlocked + locked (hidden ones show as ???)
    const fields = [];
    for (const [key, t] of Object.entries(db.TITLES)) {
      const own = owned.includes(key);
      if (!own && t.rarity === 'hidden') continue;
      const tag = RARITY_TAG[t.rarity] || '▪️';
      const equippedMark = equipped === key ? ' **← equipped**' : '';
      fields.push([`${tag} ${t.name}${own ? equippedMark : ''}`, own ? `✅ unlocked — ${t.desc}` : `🔒 ${t.desc}`]);
    }
    const ownedCount = owned.length;
    const header = [
      ['Owned', `**${ownedCount}/${Object.keys(db.TITLES).length}** titles`],
      ['Now showing', equipped ? `**${db.TITLES[equipped].name}**` : 'none — equip one with `v title equip <key>`'],
      ['', 'titles unlock as u play — hunt, hatch, win battles, reach milestones'],
    ];
    message.channel.send({
      embeds: [embed('🎖️ Titles', header.concat(fields).slice(0, 20), 0x57f287)],
    });
  },
};