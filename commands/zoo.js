const db = require('../db');
const { embed } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '👑' };
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
const COLOR_TO_RARITY = { gray: 'common', grey: 'common', white: 'common', green: 'uncommon', blue: 'rare', purple: 'epic', yellow: 'legendary', gold: 'legendary' };
const PER_PAGE = 10;

module.exports = {
  name: 'zoo',
  helpCategory: 'Pets',
  helpArgs: '[rarity|color]',
  description: 'view your animals (optional rarity filter, e.g. `v zoo green`)',
  async execute(message, args) {
    const userId = message.author.id;
    const filterArg = (args[0] || '').toLowerCase();
    let animals = db.getUserAnimals(userId);
    if (!animals.length) return message.channel.send({ embeds: [require('../utils/embed').error('you have no animals — try `v hunt`')] });

    let filterName = null;
    if (filterArg) {
      filterName = RARITY_RANK[filterArg] !== undefined ? filterArg : COLOR_TO_RARITY[filterArg];
      if (!filterName) return message.channel.send({ embeds: [require('../utils/embed').error(`unknown rarity or color \`${args[0]}\` — try: gray, green, blue, purple, yellow, or common, uncommon, rare, epic, legendary, mythic`)] });
      animals = animals.filter(a => a.rarity === filterName);
      if (!animals.length) return message.channel.send({ embeds: [require('../utils/embed').error(`you have no ${RARITY_EMOJIS[filterName]} **${filterName}** animals`)] });
    }

    animals = animals.sort((a, b) => (RARITY_RANK[(b.rarity||'').toLowerCase()] - RARITY_RANK[(a.rarity||'').toLowerCase()]) || (b.level - a.level));

    const team = db.getTeam(userId);
    const teamIds = team ? new Set([team.slot1, team.slot2, team.slot3].filter(Boolean)) : new Set();
    const lines = animals.map(a => {
      const teamTag = teamIds.has(a.id) ? ' 🛡️' : '';
      const shinyTag = a.shiny ? ' ✨' : '';
      const r = (a.rarity || 'common').toLowerCase();
      const emoji = RARITY_EMOJIS[r] || '⚪';
      const nameTag = a.name && a.name !== 'Unnamed' && a.name !== a.species ? `"${a.name}"` : '';
      return `\`#${a.id}\` ${emoji} **${a.species}**${shinyTag} Lv.${a.level} ${nameTag} ${teamTag}`;
    });

    const total = animals.length;
    const rarityCounts = {};
    for (const a of animals) {
      const r = (a.rarity || 'common').toLowerCase();
      rarityCounts[r] = (rarityCounts[r] || 0) + 1;
    }
    const summary = Object.entries(rarityCounts).map(([r, c]) => `${RARITY_EMOJIS[r] || '⚪'} ${c}`).join(' · ');
    const pageCount = Math.ceil(lines.length / PER_PAGE);

    const decors = db.getZooDecors(userId);
    const decorLine = decors.length ? db.ZOO_DECOR.filter(d => decors.includes(d.id)).map(d => d.emoji).join(' ') + ' ' : '';

    const buildEmbed = (page) => embed(`${decorLine}${filterName ? `${RARITY_EMOJIS[filterName]} Zoo — ${filterName} (${total})` : `🎪 Zoo (${total})`}`, [
      ['Summary', summary || 'none'],
      ['Gems & Essence', `**${db.getGems(userId)}** gems · **${db.getEssence(userId)}** essence`],
      ['', lines.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).join('\n')],
      ['', `page **${page + 1}/${pageCount}** · \`v team\` to view battle team · \`v zoo green\` to filter by color · \`v sell <id|species>\` to sell · \`v sacrifice <rarity>\` for essence`],
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
