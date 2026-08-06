const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MAX_PLAYERS = 5;
const JOIN_TIME = 45000;

module.exports = {
  name: 'heist',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'start a heist — others join, roll success for a big payout',
  async execute(message, args) {
    const userId = message.author.id;
    const amount = parseAmount(args[0]);
    if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('bet an amount — e.g. `v heist 50k`')] });
    const bal = db.getBalance(userId);
    if (bal < amount) return message.channel.send({ embeds: [error(`you need **${amount.toLocaleString()}** ${config.currency} to start a heist (you have **${bal.toLocaleString()}**)`)] });

    const players = new Set([userId]);
    db.addBalance(userId, -amount);

    const joinBtn = new ButtonBuilder().setCustomId('heist_join').setLabel('Join Heist').setStyle(ButtonStyle.Primary).setEmoji('🦹');
    const row = new ActionRowBuilder().addComponents(joinBtn);

    const successChance = (n) => Math.min(0.85, 0.45 + (n - 1) * 0.1);
    const payoutMult = (n) => 1.5 + (n - 1) * 0.25;

    const buildEmbed = (statusLine) => embed('🦹 Heist', [
      ['Leader', `<@${userId}>`],
      ['Stake', `**${amount.toLocaleString()}** ${config.currency} each`],
      ['Team', `${players.size}/${MAX_PLAYERS} — ${[...players].map(id => `<@${id}>`).join(' ')}`],
      ['', statusLine],
    ], 0xfee75c);

    const msg = await message.channel.send({ embeds: [buildEmbed(`**${Math.floor(JOIN_TIME / 1000)}s** to join — hit **Join Heist**!`)] , components: [row] });

    const filter = i => i.customId === 'heist_join' && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: JOIN_TIME });

    col.on('collect', async (i) => {
      const pid = i.user.id;
      if (players.has(pid)) {
        return i.reply({ embeds: [error('you already joined this heist')], ephemeral: true });
      }
      if (players.size >= MAX_PLAYERS) {
        return i.reply({ embeds: [error('the heist is full')], ephemeral: true });
      }
      const pBal = db.getBalance(pid);
      if (pBal < amount) {
        return i.reply({ embeds: [error(`you need **${amount.toLocaleString()}** ${config.currency} to join (you have **${pBal.toLocaleString()}**)`)] , ephemeral: true });
      }
      db.addBalance(pid, -amount);
      players.add(pid);
      await i.update({ embeds: [buildEmbed(players.size >= MAX_PLAYERS ? 'the crew is full — rolling the dice...' : `**${Math.floor((col.endTime - Date.now()) / 1000)}s** to join — hit **Join Heist**!`)], components: [row] }).catch(() => {});
      if (players.size >= MAX_PLAYERS) col.stop('full');
    });

    col.on('end', async () => {
      const n = players.size;
      if (n < 2) {
        db.addBalance(userId, amount);
        await msg.edit({ embeds: [embed('🦹 Heist Called Off', [
          ['', 'nobody joined — your stake was refunded'],
        ], 0xed4245)], components: [] }).catch(() => {});
        return;
      }
      const chance = successChance(n);
      const mult = payoutMult(n);
      const won = Math.random() < chance;
      const pot = n * amount;
      const winnings = Math.floor(pot * mult);
      const share = Math.floor(winnings / n);

      if (won) {
        for (const pid of players) db.addBalance(pid, share);
        await msg.edit({ embeds: [embed('🦹 Heist Succeeded!', [
          ['Team', `${[...players].map(id => `<@${id}>`).join(' ')}`],
          ['Pot', `**${pot.toLocaleString()}** ${config.currency} × **${mult}x**`],
          ['Each', `**${share.toLocaleString()}** ${config.currency} 💰`],
          ['Luck', `rolled a **${(chance * 100).toFixed(0)}%** shot and made it!`],
        ], 0x57f287)], components: [] }).catch(() => {});
      } else {
        await msg.edit({ embeds: [embed('🦹 Heist Busted!', [
          ['Team', `${[...players].map(id => `<@${id}>`).join(' ')}`],
          ['Pot', `**${pot.toLocaleString()}** ${config.currency} lost`],
          ['Luck', `rolled a **${(chance * 100).toFixed(0)}%** shot and got caught 🚔`],
        ], 0xed4245)], components: [] }).catch(() => {});
      }
      message.channel.send(won
        ? `🦹 **${[...players].map(id => `<@${id}>`).join(' ')}** pulled off the heist — **${share.toLocaleString()}** ${config.currency} each!`
        : `🚔 **${[...players].map(id => `<@${id}>`).join(' ')}** got busted on the heist — **${pot.toLocaleString()}** ${config.currency} gone!`).catch(() => {});
    });
  },
};
