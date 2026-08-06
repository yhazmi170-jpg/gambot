const db = require('../db');
const { embed } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const PER_PAGE = 10;

module.exports = {
  name: 'zoo',
  helpCategory: 'Pets',
  helpArgs: '',
  description: 'view all your animals',
  async execute(message, args) {
    const userId = message.author.id;
    let animals = db.getUserAnimals(userId);
    if (!animals.length) return message.channel.send({ embeds: [require('../utils/embed').error('you have no animals — try `v hunt`')] });

    animals = animals.sort((a, b) => (RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity]) || (b.level - a.level));

    const team = db.getTeam(userId);
    const teamIds = team ? new Set([team.slot1, team.slot2, team.slot3].filter(Boolean)) : new Set();
    const lines = animals.map(a => {
      const teamTag = teamIds.has(a.id) ? ' ⭐' : '';
      return `\`#${a.id}\` ${RARITY_EMOJIS[a.rarity]} **${a.species}** Lv.${a.level} ${a.name !== 'Unnamed' ? `"${a.name}"` : ''} ${teamTag}`;
    });

    const total = animals.length;
    const rarityCounts = {};
    for (const a of animals) rarityCounts[a.rarity] = (rarityCounts[a.rarity] || 0) + 1;
    const summary = Object.entries(rarityCounts).map(([r, c]) => `${RARITY_EMOJIS[r]} ${c}`).join(' · ');
    const pageCount = Math.ceil(lines.length / PER_PAGE);

    const buildEmbed = (page) => embed(`🐾 Zoo (${total})`, [
      ['Summary', summary || 'none'],
      ['Gems & Essence', `**${db.getGems(userId)}** gems · **${db.getEssence(userId)}** essence`],
      ['', lines.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).join('\n')],
      ['', `page **${page + 1}/${pageCount}** · \`v team\` to view battle team · \`v sell <id|species>\` to sell · \`v sacrifice <rarity>\` for essence`],
    ], 0x57f287);

    if (pageCount <= 1) return message.channel.send({ embeds: [buildEmbed(0)] });

    const prev = new ButtonBuilder().setCustomId('zoo_prev').setLabel('◀').setStyle(ButtonStyle.Secondary);
    const next = new ButtonBuilder().setCustomId('zoo_next').setLabel('▶').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(prev, next);

    let page = 0;
    const msg = await message.channel.send({ embeds: [buildEmbed(0)], components: [row] });

    const filter = i => i.user.id === userId && (i.customId === 'zoo_prev' || i.customId === 'zoo_next');
    const col = msg.createMessageComponentCollector({ filter, time: 120000 });

    col.on('collect', async (interaction) => {
      page = interaction.customId === 'zoo_next' ? Math.min(page + 1, pageCount - 1) : Math.max(page - 1, 0);
      await interaction.update({ embeds: [buildEmbed(page)], components: [row] }).catch(() => {});
    });

    col.on('end', async () => {
      await msg.edit({ components: [] }).catch(() => {});
    });
  },
};
