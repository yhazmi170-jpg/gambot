const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'duel',
  aliases: ['challenge'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'duel')) {
      return message.channel.send({ embeds: [error("you don't own the duel perk. buy it from the shop.")] });
    }
    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id || target.bot) {
      return message.channel.send({ embeds: [error('mention someone to duel')] });
    }
    const amount = parseAmount(args[1]);
    if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('enter a valid bet amount')] });

    const sender = db.ensureUser(message.author.id);
    if (sender.balance < amount) return message.channel.send({ embeds: [error("you don't have enough money")] });
    const receiver = db.ensureUser(target.id);
    if (!receiver || receiver.balance < amount) return message.channel.send({ embeds: [error(`${target.username} doesn't have enough money to match`)] });

    const accept = new ButtonBuilder().setCustomId('duel_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('⚔️');
    const decline = new ButtonBuilder().setCustomId('duel_decline').setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('✋');
    const row = new ActionRowBuilder().addComponents(accept, decline);

    message.channel.send({
      embeds: [embed('⚔️ Duel Challenge', [
        ['Challenger', `<@${message.author.id}>`],
        ['Opponent', `<@${target.id}>`],
        ['Bet', `**${amount.toLocaleString()}** ${config.currency}`],
        ['', `${target}, do you accept?`],
      ], 0xfee75c)],
      components: [row],
    }).then(msg => {
      const filter = i => i.user.id === target.id && ['duel_accept', 'duel_decline'].includes(i.customId);
      const col = msg.createMessageComponentCollector({ filter, time: 30000, max: 1 });
      col.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === 'duel_decline') {
          msg.edit({ embeds: [embed('✋ Duel Declined', [], 0xed4245)], components: [] }).catch(() => {});
          return;
        }
        const sNow = db.ensureUser(message.author.id);
        const rNow = db.ensureUser(target.id);
        if (sNow.balance < amount || rNow.balance < amount) {
          msg.edit({ embeds: [error('someone can\'t afford the bet anymore')], components: [] }).catch(() => {});
          return;
        }
        const winner = Math.random() < 0.5 ? message.author : target;
        const loser = winner.id === message.author.id ? target : message.author;
        db.addBalance(winner.id, amount);
        db.addBalance(loser.id, -amount);
        msg.edit({
          embeds: [success(`⚔️ **${winner.username}** won the duel against **${loser.username}** and earned **${amount.toLocaleString()}** ${config.currency}!`)],
          components: [],
        }).catch(() => {});
      });
      col.on('end', async (collected) => {
        if (!collected.size) {
          await msg.edit({ embeds: [embed('⏱ Duel expired', [], 0xed4245)], components: [] }).catch(() => {});
        }
      });
    });
  },
};
