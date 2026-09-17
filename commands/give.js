const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = config.ownerId || '536278876247162882';
const GIVE_MUTE_SECONDS = 30 * 60;
const APPROVAL_TTL_MS = 5 * 60 * 1000;

// token -> { giverId, amount, confirmMsg, dmMsg } for pending owner approvals
const pendingApprovals = new Map();

function approvalRow(token) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ogive_keep_${token}`).setLabel('Keep').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`ogive_decline_${token}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('💸'),
    new ButtonBuilder().setCustomId(`ogive_mute_${token}`).setLabel('Mute 30m').setStyle(ButtonStyle.Secondary).setEmoji('🔇'),
  );
}

async function notifyOwner(client, giverId, amount, confirmMsg) {
  if (!client || !client.users) return;
  const token = Math.random().toString(36).slice(2, 8);
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return;

  const dmMsg = await owner.send({
    embeds: [embed('💸 Someone sent u money', [
      ['From', `<@${giverId}>`],
      ['Amount', `**${amount.toLocaleString()}** ${config.currency}`],
      ['', 'keep it, decline it (refunds them), or mute them for 30 min'],
    ], 0xfee75c)],
    components: [approvalRow(token)],
  }).catch(() => null);
  if (!dmMsg) return;

  pendingApprovals.set(token, { giverId, amount, confirmMsg, dmMsg });
  setTimeout(async () => {
    const p = pendingApprovals.get(token);
    if (!p) return;
    pendingApprovals.delete(token);
    if (p.dmMsg && !p.dmMsg.deleted) {
      await p.dmMsg.edit({
        embeds: [embed('💸 Transfer approved', [['', 'approval window closed — money kept']], 0x2b2d31)],
        components: [],
      }).catch(() => {});
    }
  }, APPROVAL_TTL_MS);
}

async function handleInteraction(i) {
  const parts = (i.customId || '').split('_');
  if (parts[0] !== 'ogive' || !parts[2]) return;
  if (i.user.id !== OWNER_ID) {
    return i.deferUpdate().catch(() => {});
  }
  const token = parts[2];
  const p = pendingApprovals.get(token);
  if (!p) {
    return i.update({ embeds: [error('this approval was already handled or expired')], components: [] }).catch(() => {});
  }
  pendingApprovals.delete(token);
  const action = parts[1];

  if (action === 'decline') {
    const res = db.declineOwnerGive(p.giverId, p.amount);
    if (res.ok) {
      await i.update({
        embeds: [embed('💥 Declined', [['', `the **${p.amount.toLocaleString()}** ${config.currency} was returned to <@${p.giverId}>`]], 0xed4245)],
        components: [],
      }).catch(() => {});
      if (p.confirmMsg && p.confirmMsg.editable !== false) {
        await p.confirmMsg.edit({
          embeds: [embed('💥 Declined', [['', `<@${p.giverId}>: owner declined the transfer — refunded`]], 0xed4245)],
          components: [],
        }).catch(() => {});
      }
    } else {
      await i.update({
        embeds: [error('cant decline — the money is already gone (balance dropped below it)')],
        components: [],
      }).catch(() => {});
    }
    return;
  }

  if (action === 'mute') {
    db.muteOwnerGive(p.giverId, GIVE_MUTE_SECONDS);
    await i.update({
      embeds: [embed('🔇 Muted', [['', `<@${p.giverId}> cant give u money for **30 min**`]], 0xed4245)],
      components: [],
    }).catch(() => {});
    if (p.confirmMsg && p.confirmMsg.editable !== false) {
      await p.confirmMsg.edit({
        embeds: [embed('🔇 Muted', [['', `owner muted <@${p.giverId}> — they cant gift money for 30 min`]], 0xed4245)],
        components: [],
      }).catch(() => {});
    }
    return;
  }

  // keep
  if (p.dmMsg && !p.dmMsg.deleted) {
    await p.dmMsg.edit({
      embeds: [embed('✅ Kept', [['', `the **${p.amount.toLocaleString()}** ${config.currency} stays`]], 0x57f287)],
      components: [],
    }).catch(() => {});
  }
}

module.exports = {
  name: 'give',
  helpCategory: 'Economy',
  helpArgs: '<@user> <amount>',
  description: 'give money to someone',
  aliases: ['pay', 'share', 'donate'],
  pendingApprovals,
  notifyOwner,
  handleInteraction,
  execute(message, args) {
    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id) {
      return message.channel.send({ embeds: [error('mention someone to give money to')] });
    }

    if (target.id === OWNER_ID && db.isOwnerGiveMuted(message.author.id)) {
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
        if (target.id === OWNER_ID) {
          db.addBalance(target.id, amount);
        } else {
          db.createDelivery(target.id, { sender: message.author.id, source: 'give', label: `gift from <@${message.author.id}>`, amount });
        }
        db.trackProgress(message.author.id, 'give', amount);
        db.addPassXp(message.author.id, db.PASS_XP.give);
        await i.update({
          embeds: [target.id === OWNER_ID
            ? success(`gave **${amount.toLocaleString()}** ${config.currency} to <@${target.id}>`)
            : success(`sent **${amount.toLocaleString()}** ${config.currency} to <@${target.id}> — it's waiting in their inbox (**v claim**)`)],
          components: [],
        }).catch(() => {});
        if (target.id === OWNER_ID) {
          notifyOwner(message.client, message.author.id, amount, msg).catch(() => {});
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