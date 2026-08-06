const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'blackmarket',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'rotating special deals — limited stock, refresh every 6h',
  aliases: ['bm', 'blackmarket', 'market'],
  async execute(message, args) {
    const userId = message.author.id;
    const items = db.getBlackMarket();
    const fmt = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}m` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);

    const lines = items.map(it =>
      `\`${fmt(it.price)}\` ${it.def.name} — ${it.def.desc} (${it.stock} left)`
    );

    const buttons = items.map(it =>
      new ButtonBuilder().setCustomId(`bm_${it.slot}`).setLabel(`${it.def.name.split(' ')[1] || it.def.name} - ${fmt(it.price)}`).setStyle(ButtonStyle.Danger)
    );
    const row = new ActionRowBuilder().addComponents(buttons);

    const msg = await message.channel.send({
      embeds: [embed('🖤 Black Market', [
        ['', lines.join('\n')],
        ['', 'limited stock — when it\'s gone, it\'s gone until the refresh'],
      ], 0x2b2d31)],
      components: [row],
    });

    const filter = i => i.user.id === userId && i.customId.startsWith('bm_');
    const col = msg.createMessageComponentCollector({ filter, time: 60000 });

    col.on('collect', async (i) => {
      const slot = parseInt(i.customId.replace('bm_', ''), 10);
      const res = db.buyBlackMarketItem(userId, slot);
      if (!res.ok) {
        const reason = res.reason === 'coins' ? 'you don\'t have enough coins' : 'that item is sold out';
        return i.reply({ embeds: [error(reason)], ephemeral: true });
      }
      await i.reply({ embeds: [success(`bought **${res.item.name}** for **${res.price.toLocaleString()}** ${config.currency}!`)], ephemeral: true });
      const updated = db.getBlackMarket();
      const newLines = updated.map(it => `\`${fmt(it.price)}\` ${it.def.name} — ${it.def.desc} (${it.stock} left)`);
      await msg.edit({ embeds: [embed('🖤 Black Market', [['', newLines.join('\n')], ['', 'limited stock — when it\'s gone, it\'s gone until the refresh']], 0x2b2d31)] }).catch(() => {});
    });
  },
};
