const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'agree',
  aliases: ['accept', 'tos'],
  async execute(message, args) {
    if (db.isRegistered(message.author.id)) {
      return message.channel.send({ embeds: [error('you already accepted the TOS')] });
    }

    const acceptBtn = new ButtonBuilder()
      .setCustomId('tos_accept')
      .setLabel('I Agree')
      .setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(acceptBtn);

    const msg = await message.channel.send({
      embeds: [embed('📋 Terms of Service', [
        ['Welcome', 'by using this bot you agree to:'],
        ['Rules', 'no abuse of bugs, no spam, no harassment'],
        ['Risks', 'gambling is virtual only — no real money involved'],
        ['Data', 'we store your user ID and game stats for leaderboards'],
        ['', `click **I Agree** to get **${db.START_BALANCE}** money and start playing`],
      ], 0x5865f2)],
      components: [row],
    });

    const filter = i => i.user.id === message.author.id && i.customId === 'tos_accept';
    const col = msg.createMessageComponentCollector({ filter, time: 60000, max: 1 });

    col.on('collect', async (interaction) => {
      db.acceptTerms(message.author.id);
      await interaction.update({
        embeds: [embed('✅ Terms Accepted', [
          ['', `you got **${db.START_BALANCE}** money to start! try \`v help\``],
        ], 0x57f287)],
        components: [],
      });
    });

    col.on('end', async (collected) => {
      if (!collected.size) {
        await msg.edit({ components: [] }).catch(() => {});
      }
    });
  },
};
