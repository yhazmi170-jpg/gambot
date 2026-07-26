const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'marry',
  helpCategory: 'Social',
  helpArgs: '<@user>',
  aliases: ['adopt', 'divorce'],
  execute(message, args) {
    const sub = message.content.split(/\s+/).slice(1)[0] || '';

    if (sub === 'divorce' || sub === 'div') {
      const marriage = db.getMarriage(message.author.id);
      if (!marriage) return message.channel.send({ embeds: [error('you are not married')] });
      const partnerId = marriage.user_id === message.author.id ? marriage.partner_id : marriage.user_id;
      db.deleteMarriage(message.author.id);
      return message.channel.send({ embeds: [success(`divorced <@${partnerId}> 💔`)] });
    }

    if (sub === 'adopt') {
      const target = message.mentions.users.first();
      if (!target || target.id === message.author.id) return message.channel.send({ embeds: [error('mention someone to adopt')] });
      const parents = db.getParents(target.id);
      if (parents.length >= 2) return message.channel.send({ embeds: [error('they already have 2 parents')] });
      const myChildren = db.getChildren(message.author.id);
      if (myChildren.length >= 3) return message.channel.send({ embeds: [error('you already have 3 children')] });
      const marry = db.getMarriage(message.author.id);
      if (!marry) return message.channel.send({ embeds: [error('you need to be married to adopt')] });

      const confirmBtn = new ButtonBuilder().setCustomId('adopt_yes').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅');
      const cancelBtn = new ButtonBuilder().setCustomId('adopt_no').setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('❌');
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      message.channel.send({
        embeds: [embed('👨‍👦 Adoption', [
          ['Parent', `<@${message.author.id}>`],
          ['Child', `<@${target.id}>`],
          ['', `${target.username}, do you accept?`],
        ], 0xfee75c)],
        components: [row],
      }).then(msg => {
        const filter = i => i.user.id === target.id && ['adopt_yes', 'adopt_no'].includes(i.customId);
        const col = msg.createMessageComponentCollector({ filter, time: 30000, max: 1 });
        col.on('collect', async (i) => {
          await i.deferUpdate().catch(() => {});
          if (i.customId === 'adopt_no') { msg.edit({ embeds: [embed('❌ Adoption declined', [], 0xed4245)], components: [] }).catch(() => {}); return; }
          db.adoptChild(message.author.id, target.id);
          const partnerId = marry.user_id === message.author.id ? marry.partner_id : marry.user_id;
          db.adoptChild(partnerId, target.id);
          msg.edit({ embeds: [success(`<@${target.id}> was adopted by <@${message.author.id}> & <@${partnerId}> 🎉`)], components: [] }).catch(() => {});
        });
        col.on('end', async (collected) => {
          if (!collected.size) msg.edit({ embeds: [embed('⏱ Adoption expired', [], 0xed4245)], components: [] }).catch(() => {});
        });
      });
      return;
    }

    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id) return message.channel.send({ embeds: [error('mention someone to marry')] });
    if (db.getMarriage(message.author.id)) return message.channel.send({ embeds: [error('you are already married')] });
    if (db.getMarriage(target.id)) return message.channel.send({ embeds: [error('they are already married')] });

    const proposeBtn = new ButtonBuilder().setCustomId('marry_yes').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('💍');
    const rejectBtn = new ButtonBuilder().setCustomId('marry_no').setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('❌');
    const row = new ActionRowBuilder().addComponents(proposeBtn, rejectBtn);

    message.channel.send({
      embeds: [embed('💍 Marriage Proposal', [
        ['From', `<@${message.author.id}>`],
        ['To', `<@${target.id}>`],
        ['', `${target.username}, do you accept?`],
      ], 0xfee75c)],
      components: [row],
    }).then(msg => {
      const filter = i => i.user.id === target.id && ['marry_yes', 'marry_no'].includes(i.customId);
      const col = msg.createMessageComponentCollector({ filter, time: 30000, max: 1 });
      col.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === 'marry_no') { msg.edit({ embeds: [embed('💔 Proposal declined', [], 0xed4245)], components: [] }).catch(() => {}); return; }
        db.setMarriage(message.author.id, target.id);
        msg.edit({ embeds: [success(`<@${message.author.id}> & <@${target.id}> are now married! 💍🎉`)], components: [] }).catch(() => {});
      });
      col.on('end', async (collected) => {
        if (!collected.size) msg.edit({ embeds: [embed('⏱ Proposal expired', [], 0xed4245)], components: [] }).catch(() => {});
      });
    });
  },
};
