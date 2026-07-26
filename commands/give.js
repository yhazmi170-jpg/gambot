const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'give',
  aliases: ['pay', 'share', 'donate'],
  execute(message, args) {
    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id) {
      return message.channel.send({ embeds: [error('mention someone to give money to')] });
    }

    const amount = parseAmount(args[1]);
    if (isNaN(amount) || amount <= 0) {
      return message.channel.send({ embeds: [error('enter a valid amount')] });
    }

    const sender = db.ensureUser(message.author.id);
    if (sender.balance < amount) {
      return message.channel.send({ embeds: [error('you dont have enough money')] });
    }

    const confirmBtn = new ButtonBuilder().setCustomId('give_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅');
    const cancelBtn = new ButtonBuilder().setCustomId('give_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌');
    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    message.channel.send({
      embeds: [embed('💸 Confirm Transfer', [
        ['To', `<@${target.id}>`],
        ['Amount', `**${amount.toLocaleString()}** ${config.currency}`],
        ['', 'confirm to send?'],
      ], 0xfee75c)],
      components: [row],
    }).then(msg => {
      const filter = i => i.user.id === message.author.id && ['give_confirm', 'give_cancel'].includes(i.customId);
      const col = msg.createMessageComponentCollector({ filter, time: 15000, max: 1 });
      col.on('collect', async (i) => {
        if (i.customId === 'give_cancel') {
          await i.update({ embeds: [embed('❌ Cancelled', [], 0xed4245)], components: [] }).catch(() => {});
          return;
        }
        const senderNow = db.ensureUser(message.author.id);
        if (senderNow.balance < amount) {
          await i.update({ embeds: [error('balance changed — not enough money anymore')], components: [] }).catch(() => {});
          return;
        }
        db.addBalance(message.author.id, -amount);
        db.addBalance(target.id, amount);
        await i.update({
          embeds: [success(`gave **${amount.toLocaleString()}** ${config.currency} to <@${target.id}>`)],
          components: [],
        }).catch(() => {});
      });
      col.on('end', async (collected) => {
        if (!collected.size) {
          await msg.edit({ embeds: [embed('⏱ Expired', [], 0xed4245)], components: [] }).catch(() => {});
        }
      });
    });
  },
};
