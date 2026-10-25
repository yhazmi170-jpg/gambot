const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function notifyOwner(client, giver, amount) {
  if (!client || !client.users) return;
  const admins = (await Promise.all(config.dmOwners.map((id) => client.users.fetch(id).catch(() => null))))
    .filter(Boolean);
  if (!admins.length) return;

  const giverTag = giver.username ? `**${giver.username}** (<@${giver.id}>)` : `<@${giver.id}>`;

  for (const owner of admins) {
    await owner.send({
      embeds: [embed('💸 Received Money', [
        ['From', giverTag],
        ['Amount', `**${amount.toLocaleString()}** ${config.currency}`],
      ], 0x57f287)],
    }).catch(() => {});
  }
}

async function handleInteraction(i) {
  return i.deferUpdate().catch(() => {});
}

module.exports = {
  name: 'give',
  helpCategory: 'Economy',
  helpArgs: '<@user> <amount>',
  description: 'give money to someone',
  aliases: ['pay', 'share', 'donate'],
  notifyOwner,
  handleInteraction,
  execute(message, args) {
    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id) {
      return message.channel.send({ embeds: [error('mention someone to give money to')] });
    }

    if (config.isOwner(target.id) && db.isOwnerGiveMuted(message.author.id)) {
      return message.channel.send({ embeds: [error('u cant give this user money')] });
    }

    const amount = parseAmount(args[1]);
    if (isNaN(amount) || amount <= 0) {
      return message.channel.send({ embeds: [error('enter a valid amount')] });
    }

    const sender = db.ensureUser(message.author.id);
    if (sender.balance < amount) {
      return message.channel.send({ embeds: [error('you dont have enough money')] });
    }
    if (db.hasOutstandingLoan(message.author.id)) {
      return message.channel.send({ embeds: [error('repay your loan first — `v bank loan pay all`')] });
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
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
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
        db.exec(`UPDATE users SET money_sent = money_sent + ${amount} WHERE user_id = '${message.author.id}'`);
        if (config.isOwner(target.id)) {
          db.addBalance(target.id, amount);
        } else {
          db.createDelivery(target.id, { sender: message.author.id, source: 'give', label: `gift from <@${message.author.id}>`, amount });
        }
        db.trackProgress(message.author.id, 'give', amount);
        db.addPassXp(message.author.id, db.PASS_XP.give);
        await i.update({
          embeds: [config.isOwner(target.id)
            ? success(`gave **${amount.toLocaleString()}** ${config.currency} to <@${target.id}>`)
            : success(`sent **${amount.toLocaleString()}** ${config.currency} to <@${target.id}> — it's waiting in their inbox (**v claim**)`)],
          components: [],
        }).catch(() => {});
        if (config.isOwner(target.id)) {
          notifyOwner(message.client, message.author, amount).catch(() => {});
        }
      });
      col.on('end', async (collected) => {
        if (!collected.size) {
          await msg.edit({ embeds: [embed('⏱ Expired', [], 0xed4245)], components: [] }).catch(() => {});
        }
      });
    });
  },
};