const db = require('../db');
const { embed, error } = require('../utils/embed');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PER_PAGE = 10;

module.exports = {
  name: 'weapon',
  helpCategory: 'Pets',
  helpArgs: '<list|equip|upgrade>',
  description: 'view and equip weapons on your battle team',
  aliases: ['weps', 'armory', 'wep'],
  async execute(message, args) {
    const userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'list' || !sub || sub === 'inv' || /^\d+$/.test(sub)) {
      const inv = db.getWeaponInv(userId);
      if (!inv.length) {
        return message.channel.send({ embeds: [embed('🔫 Armory', [['', 'you have no weapons yet — buy a crate with `v weaponcrate buy` or win one from battle/hunt!']], 0x2b2d31)] });
      }
      const lines = inv.map(w => {
        const tag = db.WEAPON_RARITY_TAG[w.rarity] || '⬜';
        return `\`#${w.id}\` ${tag} ${w.emoji} **${w.name}** (${w.rarity} · ${w.quality}%) Lv.${w.level} — ATK **+${w.atk}** · DEF **+${w.def}**`;
      });

      const pageCount = Math.ceil(lines.length / PER_PAGE);
      let pageArg = parseInt(sub === 'list' || sub === 'inv' || !sub ? args[1] : sub, 10);
      let page = Number.isInteger(pageArg) && pageArg >= 1 ? Math.min(pageArg - 1, pageCount - 1) : 0;

      const buildEmbed = (p) => {
        const slice = lines.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
        return embed(`🔫 Armory (${inv.length})`, [
          [`Weapons (${p * PER_PAGE + 1}-${Math.min((p + 1) * PER_PAGE, inv.length)} of ${inv.length})`, slice.join('\n')],
          ['', `page **${p + 1}/${pageCount}** · \`v weapon equip #<wepId> #<animalId>\` · \`v weapon upgrade #<wepId>\``],
        ], 0x2b2d31);
      };

      if (pageCount <= 1) {
        return message.channel.send({ embeds: [buildEmbed(0)] });
      }

      const prev = new ButtonBuilder().setCustomId('wep_prev').setLabel('◀').setStyle(ButtonStyle.Secondary);
      const next = new ButtonBuilder().setCustomId('wep_next').setLabel('▶').setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(prev, next);

      const msg = await message.channel.send({ embeds: [buildEmbed(page)], components: [row] });
      if (!msg || typeof msg.createMessageComponentCollector !== 'function') return;

      const filter = i => i.user.id === userId && (i.customId === 'wep_prev' || i.customId === 'wep_next');
      const col = msg.createMessageComponentCollector({ filter, time: 120000 });

      col.on('collect', async (interaction) => {
        page = interaction.customId === 'wep_next' ? Math.min(page + 1, pageCount - 1) : Math.max(page - 1, 0);
        await interaction.update({ embeds: [buildEmbed(page)], components: [row] }).catch(() => {});
      });

      col.on('end', async () => {
        await msg.edit({ components: [] }).catch(() => {});
      });
      return;
    }

    if (sub === 'equip') {
      const weapId = parseInt(String(args[1] || '').replace(/[^0-9]/g, ''));
      const animId = parseInt(String(args[2] || '').replace(/[^0-9]/g, ''));
      if (!weapId || !animId) {
        return message.channel.send({ embeds: [error('usage: `v weapon equip #<weaponId> #<animalId>` — animal must be on your battle team')] });
      }
      const res = db.equipWeapon(animId, weapId, userId);
      if (!res.ok) {
        const reasons = {
          notfound: 'weapon or animal not found',
          notyours_animal: "that animal isn't yours",
          notyours_weapon: "that weapon isn't yours",
          notonteam: 'that animal must be on your battle team first — `v team add #<id>`',
        };
        return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not equip')] });
      }
      const w = res.weapon;
      const tag = db.WEAPON_RARITY_TAG[w.rarity] || '⬜';
      return message.channel.send({ embeds: [embed('✅ Equipped', [[`${res.animal.species}`, `${tag} ${w.emoji} **${w.name}** (${w.rarity} · ${w.quality}%) — ATK **+${w.atk}** · DEF **+${w.def}**`]], 0x57f287)] });
    }

    if (sub === 'upgrade') {
      const weapId = parseInt(String(args[1] || '').replace(/[^0-9]/g, ''));
      if (!weapId) return message.channel.send({ embeds: [error('usage: `v weapon upgrade #<weaponId>`')] });
      const res = db.upgradeWeapon(weapId, userId);
      if (!res.ok) {
        const reasons = { notfound: 'weapon not found', notyours: "that weapon isn't yours", coins: `not enough coins — need **${res.cost.toLocaleString()}**` };
        return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not upgrade')] });
      }
      const w = db.getWeapon(weapId);
      const tag = db.WEAPON_RARITY_TAG[w.rarity] || '⬜';
      return message.channel.send({ embeds: [embed('⬆️ Weapon Upgrade', [[`${tag} ${w.emoji} ${w.name}`, `now **Lv.${res.level}** — ATK **+${res.atk}** · DEF **+${res.def}**\nnext upgrade (Lv.${res.level + 1}): **${db.weaponUpgradeCost(w.rarity, res.level).toLocaleString()}** coins`]], 0x57f287)] });
    }

    return message.channel.send({ embeds: [error('usage:\n`v weapon list` — see your weapons\n`v weapon equip #<wepId> #<animalId>` — equip on a team pet\n`v weapon upgrade #<wepId>` — level it up')] });
  },
};
