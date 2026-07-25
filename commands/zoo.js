const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'zoo',
  description: 'view all your animals',
  async execute(message, args) {
    const animals = db.getUserAnimals(message.author.id);
    if (!animals.length) return message.channel.send({ embeds: [require('../utils/embed').error('you have no animals — try `v hunt`')] });

    const rarityEmojis = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
    const lines = animals.map((a, i) => {
      const team = db.getTeam(message.author.id);
      const onTeam = team && (team.slot1 === a.id || team.slot2 === a.id || team.slot3 === a.id);
      const teamTag = onTeam ? ' ⭐' : '';
      return `\`#${a.id}\` ${rarityEmojis[a.rarity]} **${a.species}** Lv.${a.level} ${a.name !== 'Unnamed' ? `"${a.name}"` : ''} ${teamTag}`;
    });

    const pages = [];
    for (let i = 0; i < lines.length; i += 10) {
      pages.push(lines.slice(i, i + 10).join('\n'));
    }

    const total = animals.length;
    const rarityCounts = {};
    for (const a of animals) {
      rarityCounts[a.rarity] = (rarityCounts[a.rarity] || 0) + 1;
    }
    const summary = Object.entries(rarityCounts).map(([r, c]) => `${rarityEmojis[r]} ${c}`).join(' · ');

    message.channel.send({
      embeds: [embed(`🐾 Zoo (${total})`, [
        ['Summary', summary || 'none'],
        ['', pages[0]],
        ['', '`v team` to view battle team · `v sell <id>` to sell'],
      ], 0x57f287)],
    });
  },
};
