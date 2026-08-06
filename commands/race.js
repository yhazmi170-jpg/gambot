const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MAX_RACERS = 6;
const JOIN_TIME = 45000;

module.exports = {
  name: 'race',
  helpCategory: 'Pets',
  helpArgs: '<amount>',
  description: 'race your best pet against others — winner takes the pot',
  aliases: ['petrace'],
  async execute(message, args) {
    const userId = message.author.id;
    const amount = parseAmount(args[0]);
    if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('bet an amount — e.g. `v race 20k`')] });
    const bal = db.getBalance(userId);
    if (bal < amount) return message.channel.send({ embeds: [error(`you need **${amount.toLocaleString()}** ${config.currency} to start a race (you have **${bal.toLocaleString()}**)`)] });

    const bestPet = db.getUserAnimals(userId).sort((a, b) => (b.attack + b.level) - (a.attack + a.level))[0];
    if (!bestPet) return message.channel.send({ embeds: [error('you need at least one pet — try `v hunt` first')] });

    const racers = [{ userId, pet: bestPet }];
    db.addBalance(userId, -amount);

    const joinBtn = new ButtonBuilder().setCustomId('race_join').setLabel('Join Race').setStyle(ButtonStyle.Primary).setEmoji('🏁');
    const row = new ActionRowBuilder().addComponents(joinBtn);

    const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

    const buildEmbed = (statusLine) => embed('🏁 Pet Race', [
      ['Stake', `**${amount.toLocaleString()}** ${config.currency} each`],
      ['Racers', `${racers.length}/${MAX_RACERS}`],
      ['', racers.map(r => `${RARITY_EMOJIS[r.pet.rarity]} **${r.pet.species}** (Lv.${r.pet.level}) — <@${r.userId}>`).join('\n')],
      ['', statusLine],
    ], 0x57f287);

    const msg = await message.channel.send({ embeds: [buildEmbed(`**${Math.floor(JOIN_TIME / 1000)}s** to join — hit **Join Race**!`)] , components: [row] });

    const filter = i => i.customId === 'race_join' && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: JOIN_TIME });

    col.on('collect', async (i) => {
      const pid = i.user.id;
      if (racers.some(r => r.userId === pid)) {
        return i.reply({ embeds: [error('you already joined this race')], ephemeral: true });
      }
      if (racers.length >= MAX_RACERS) {
        return i.reply({ embeds: [error('the race is full')], ephemeral: true });
      }
      const pBal = db.getBalance(pid);
      if (pBal < amount) {
        return i.reply({ embeds: [error(`you need **${amount.toLocaleString()}** ${config.currency} to join (you have **${pBal.toLocaleString()}**)`)], ephemeral: true });
      }
      const pet = db.getUserAnimals(pid).sort((a, b) => (b.attack + b.level) - (a.attack + a.level))[0];
      if (!pet) {
        return i.reply({ embeds: [error('you need at least one pet to race')], ephemeral: true });
      }
      db.addBalance(pid, -amount);
      racers.push({ userId: pid, pet });
      await i.update({ embeds: [buildEmbed(racers.length >= MAX_RACERS ? 'all racers in — starting...' : `**${Math.floor((col.endTime - Date.now()) / 1000)}s** to join — hit **Join Race**!`)], components: [row] }).catch(() => {});
      if (racers.length >= MAX_RACERS) col.stop('full');
    });

    col.on('end', async () => {
      if (racers.length < 2) {
        db.addBalance(userId, amount);
        await msg.edit({ embeds: [embed('🏁 Race Cancelled', [
          ['', 'nobody else joined — your stake was refunded'],
        ], 0xed4245)], components: [] }).catch(() => {});
        return;
      }
      const results = racers.map(r => ({
        ...r,
        speed: r.pet.attack * 2 + r.pet.level * 3 + Math.floor(Math.random() * 50),
      })).sort((a, b) => b.speed - a.speed);

      const pot = results.length * amount;
      const winner = results[0];
      db.addBalance(winner.userId, pot);

      const podium = results.map((r, idx) => `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏁'} **${r.pet.species}** (${r.speed} spd) — <@${r.userId}>`).join('\n');

      await msg.edit({ embeds: [embed('🏁 Race Finished!', [
        ['', podium],
        ['Pot', `**${pot.toLocaleString()}** ${config.currency} → <@${winner.userId}>`],
      ], 0x57f287)], components: [] }).catch(() => {});
      message.channel.send(`🏁 <@${winner.userId}>'s **${winner.pet.species}** won the race and takes **${pot.toLocaleString()}** ${config.currency}!`).catch(() => {});
    });
  },
};
