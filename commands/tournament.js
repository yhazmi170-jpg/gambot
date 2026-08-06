const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MAX_ENTRANTS = 16;
const JOIN_TIME = 60000;

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

function getBestPet(userId) {
  return db.getUserAnimals(userId).sort((a, b) => (b.attack + b.level) - (a.attack + a.level))[0] || null;
}

function simBattle(a, b) {
  const aPower = a.pet.attack * 2 + a.pet.level * 3 + a.pet.hp / 10 + Math.random() * 40;
  const bPower = b.pet.attack * 2 + b.pet.level * 3 + b.pet.hp / 10 + Math.random() * 40;
  return aPower >= bPower ? a : b;
}

function runBracket(entrants) {
  let round = 1;
  const roundsLog = [];
  let bracket = [...entrants];
  while (bracket.length > 1) {
    const next = [];
    const lines = [];
    for (let i = 0; i < bracket.length; i += 2) {
      if (i + 1 >= bracket.length) { next.push(bracket[i]); continue; }
      const winner = simBattle(bracket[i], bracket[i + 1]);
      const loser = winner === bracket[i] ? bracket[i + 1] : bracket[i];
      lines.push(`**${winner.pet.species}** (${RARITY_EMOJIS[winner.pet.rarity]}) beats **${loser.pet.species}** — <@${winner.userId}>`);
      next.push(winner);
    }
    roundsLog.push({ round, lines });
    bracket = next;
    round++;
  }
  return { winner: bracket[0], roundsLog };
}

module.exports = {
  name: 'tournament',
  helpCategory: 'Pets',
  helpArgs: '<entry fee>',
  description: 'bracket tournament — everyone\'s best pet fights, winner takes the pot',
  aliases: ['tourney', 'bracket'],
  async execute(message, args) {
    const hostId = message.author.id;
    const fee = parseAmount(args[0]);
    if (isNaN(fee) || fee <= 0) return message.channel.send({ embeds: [error('set an entry fee — e.g. `v tournament 50k`')] });
    const bal = db.getBalance(hostId);
    if (bal < fee) return message.channel.send({ embeds: [error(`you need **${fee.toLocaleString()}** ${config.currency} to enter (you have **${bal.toLocaleString()}**)`)] });

    const entrants = [{ userId: hostId, pet: getBestPet(hostId) }];
    if (!entrants[0].pet) return message.channel.send({ embeds: [error('you need at least one pet — try `v hunt` first')] });
    db.addBalance(hostId, -fee);

    const joinBtn = new ButtonBuilder().setCustomId('tourney_join').setLabel('Join Tournament').setStyle(ButtonStyle.Primary).setEmoji('🏆');
    const row = new ActionRowBuilder().addComponents(joinBtn);

    const buildEmbed = (statusLine) => embed('🏆 Tournament', [
      ['Entry Fee', `**${fee.toLocaleString()}** ${config.currency}`],
      ['Entrants', `${entrants.length}/${MAX_ENTRANTS}`],
      ['', entrants.map(e => `${RARITY_EMOJIS[e.pet.rarity]} **${e.pet.species}** (Lv.${e.pet.level}) — <@${e.userId}>`).join('\n')],
      ['', statusLine],
    ], 0xf1c40f);

    const msg = await message.channel.send({ embeds: [buildEmbed(`**${Math.floor(JOIN_TIME / 1000)}s** to join — hit **Join Tournament**!`)] , components: [row] });

    const filter = i => i.customId === 'tourney_join' && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: JOIN_TIME });

    col.on('collect', async (i) => {
      const pid = i.user.id;
      if (entrants.some(e => e.userId === pid)) {
        return i.reply({ embeds: [error('you already joined this tournament')], ephemeral: true });
      }
      if (entrants.length >= MAX_ENTRANTS) {
        return i.reply({ embeds: [error('the tournament is full')], ephemeral: true });
      }
      const pBal = db.getBalance(pid);
      if (pBal < fee) {
        return i.reply({ embeds: [error(`you need **${fee.toLocaleString()}** ${config.currency} to enter (you have **${pBal.toLocaleString()}**)`)], ephemeral: true });
      }
      const pet = getBestPet(pid);
      if (!pet) {
        return i.reply({ embeds: [error('you need at least one pet to enter')], ephemeral: true });
      }
      db.addBalance(pid, -fee);
      entrants.push({ userId: pid, pet });
      await i.update({ embeds: [buildEmbed(entrants.length >= MAX_ENTRANTS ? 'all slots filled — starting...' : `**${Math.floor((col.endTime - Date.now()) / 1000)}s** to join — hit **Join Tournament**!`)], components: [row] }).catch(() => {});
      if (entrants.length >= MAX_ENTRANTS) col.stop('full');
    });

    col.on('end', async () => {
      if (entrants.length < 2) {
        db.addBalance(hostId, fee);
        await msg.edit({ embeds: [embed('🏆 Tournament Cancelled', [['', 'nobody else joined — your entry fee was refunded']], 0xed4245)], components: [] }).catch(() => {});
        return;
      }

      const bracketEntrants = [...entrants];
      while (bracketEntrants.length < 16 && bracketEntrants.length % 4 !== 0) {
        bracketEntrants.push({ userId: null, pet: { species: 'BYE', rarity: 'common', level: 0, attack: 0, hp: 0 }, bye: true });
      }

      const { winner, roundsLog } = runBracket(bracketEntrants);
      const pot = entrants.length * fee;
      const winnings = Math.floor(pot * 0.9);
      db.addBalance(winner.userId, winnings);

      const roundsText = roundsLog.map(r => `**Round ${r.round}:**\n${r.lines.join('\n')}`).join('\n\n');
      await msg.edit({ embeds: [embed('🏆 Tournament Results', [
        ['Champion', `<@${winner.userId}> — **${winner.pet.species}** takes **${winnings.toLocaleString()}** ${config.currency}!`],
        ['Pot', `**${pot.toLocaleString()}** ${config.currency} (10% house cut)`],
        ['', roundsText.slice(0, 3900)],
      ], 0xf1c40f)], components: [] }).catch(() => {});
      message.channel.send(`🏆 **<@${winner.userId}>** won the tournament with **${winner.pet.species}** — took home **${winnings.toLocaleString()}** ${config.currency}!`).catch(() => {});
    });
  },
};
