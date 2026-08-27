const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

module.exports = {
  name: 'trade',
  helpCategory: 'Pets',
  helpArgs: '<@user> <animal id> [price]',
  description: 'trade an animal to another player (optional coin price)',
  aliases: ['givepet', 'giveanimal'],
  execute(message, args) {
    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id) {
      return message.channel.send({ embeds: [error('mention someone to trade with')] });
    }

    const animalId = parseInt(args[1]);
    if (isNaN(animalId) || animalId <= 0) {
      return message.channel.send({ embeds: [error('enter the animal id — find it with \`v zoo\`')] });
    }

    const animal = db.getAnimal(animalId);
    if (!animal || animal.user_id !== message.author.id) {
      return message.channel.send({ embeds: [error('you don\'t own that animal')] });
    }

    const price = args[2] ? parseAmount(args[2]) : 0;
    if (isNaN(price) || price < 0) {
      return message.channel.send({ embeds: [error('enter a valid price (or omit it for a free trade)')] });
    }
    if (price > 0) {
      const targetBal = db.getBalance(target.id);
      if (targetBal < price) {
        return message.channel.send({ embeds: [error(`<@${target.id}> only has **${targetBal.toLocaleString()}** ${config.currency} — can't afford **${price.toLocaleString()}**`)] });
      }
    }

    const confirmBtn = new ButtonBuilder().setCustomId('trade_yes').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅');
    const declineBtn = new ButtonBuilder().setCustomId('trade_no').setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('❌');
    const row = new ActionRowBuilder().addComponents(confirmBtn, declineBtn);

    const animalLine = `${RARITY_EMOJIS[animal.rarity]} **${animal.species}** (${animal.rarity}) Lv.${animal.level}`;
    const priceLine = price > 0 ? `for **${price.toLocaleString()}** ${config.currency}` : 'for free';

    message.channel.send({
      embeds: [embed('🔄 Trade Offer', [
        ['From', `<@${message.author.id}>`],
        ['To', `<@${target.id}>`],
        ['Animal', `\`#${animalId}\` ${animalLine}`],
        ['Price', priceLine],
        ['', `<@${target.id}> — accept or decline?`],
      ], 0xfee75c)],
      components: [row],
    }).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
      const filter = i => i.user.id === target.id && ['trade_yes', 'trade_no'].includes(i.customId);
      const col = msg.createMessageComponentCollector({ filter, time: 60000, max: 1 });
      col.on('collect', async (i) => {
        if (i.customId === 'trade_no') {
          await i.update({ embeds: [embed('❌ Trade declined', [], 0xed4245)], components: [] }).catch(() => {});
          return;
        }
        const current = db.getAnimal(animalId);
        if (!current || current.user_id !== message.author.id) {
          await i.update({ embeds: [error('that animal is gone — trade cancelled')], components: [] }).catch(() => {});
          return;
        }
        if (price > 0) {
          const targetBalNow = db.getBalance(target.id);
          if (targetBalNow < price) {
            await i.update({ embeds: [error('buyer ran out of coins — trade cancelled')], components: [] }).catch(() => {});
            return;
          }
          if (db.hasOutstandingLoan(target.id)) {
            await i.update({ embeds: [error('buyer has an outstanding loan — repay it first (`v bank loan pay all`)')], components: [] }).catch(() => {});
            return;
          }
          db.addBalance(target.id, -price);
          db.addBalance(message.author.id, price);
        }
        db.transferAnimal(animalId, message.author.id, target.id);
        await i.update({
          embeds: [success(`trade complete — <@${target.id}> got ${animalLine}${price > 0 ? ` and paid **${price.toLocaleString()}** ${config.currency}` : ''}`)],
          components: [],
        }).catch(() => {});
        message.channel.send(`🔄 **${message.author.username}** traded \`#${animalId}\` ${animalLine} to <@${target.id}>${price > 0 ? ` for **${price.toLocaleString()}** ${config.currency}` : ''}!`).catch(() => {});
      });
      col.on('end', async (collected) => {
        if (!collected.size) {
          await msg.edit({ embeds: [embed('⏱ Trade expired', [], 0xed4245)], components: [] }).catch(() => {});
        }
      });
    });
  },
};
