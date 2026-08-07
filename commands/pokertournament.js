const db = require('../db');
const { embed, error, parseAmount } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MAX_SEATS = 9;
const JOIN_TIME = 60000;

const SUITS = ['♥', '♦', '♣', '♠'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];

function dealHand() {
  const used = new Set();
  const cards = [];
  while (cards.length < 5) {
    const r = 2 + Math.floor(Math.random() * 13);
    const s = Math.floor(Math.random() * 4);
    const key = `${r}-${s}`;
    if (used.has(key)) continue;
    used.add(key);
    cards.push({ r, s });
  }
  return cards;
}

function cardStr(c) {
  return `${RANKS[c.r - 2]}${SUITS[c.s]}`;
}

// Evaluate best 5-card hand. Returns { cat, tb } where tb is a tie-break array.
function evalHand(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => a - b);
  const counts = {};
  for (const r of rs) counts[r] = (counts[r] || 0) + 1;
  const vals = Object.entries(counts).map(([r, c]) => ({ r: Number(r), c })).sort((a, b) => b.c - a.c || b.r - a.r);
  const isFlush = cards.every(c => c.s === cards[0].s);
  const unique = Array.from(new Set(rs)).sort((a, b) => a - b);
  const wheel = unique.length === 5 && unique[0] === 2 && unique[4] === 14;
  const straight = unique.length === 5 && unique[4] - unique[0] === 4;

  let cat;
  if (isFlush && (straight || wheel)) cat = (straight && unique[0] === 10) || wheel ? 9 : 8;
  else if (vals[0].c === 4) cat = 7;
  else if (vals[0].c === 3 && vals[1].c === 2) cat = 6;
  else if (isFlush) cat = 5;
  else if (straight || wheel) cat = 4;
  else if (vals[0].c === 3) cat = 3;
  else if (vals[0].c === 2 && vals[1].c === 2) cat = 2;
  else if (vals[0].c === 2) cat = 1;
  else cat = 0;

  let tb;
  if (cat === 9) tb = [14, 13, 12, 11, 10];
  else if (cat === 8) {
    const hi = wheel ? 5 : unique[4];
    tb = [hi, hi - 1, hi - 2, hi - 3, hi - 4];
  } else if (cat === 5) {
    tb = wheel ? [5, 4, 3, 2, 1] : unique.slice().reverse();
  } else if (cat === 7) {
    tb = [vals[0].r, vals[1].r];
  } else if (cat === 6) {
    tb = [vals[0].r, vals[1].r];
  } else if (cat === 3) {
    tb = [vals[0].r, ...unique.filter(x => x !== vals[0].r).reverse()];
  } else if (cat === 2) {
    tb = [vals[0].r, vals[1].r, vals[2].r];
  } else if (cat === 1) {
    tb = [vals[0].r, ...unique.filter(x => x !== vals[0].r).reverse()];
  } else {
    tb = unique.slice().reverse();
  }
  return { cat, tb };
}

function compareHands(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < Math.max(a.tb.length, b.tb.length); i++) {
    const x = a.tb[i] || 0;
    const y = b.tb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

module.exports = {
  name: 'pokertournament',
  helpCategory: 'Games',
  helpArgs: '<buy-in fee>',
  description: 'poker showdown — best 5-card hand wins the whole pot',
  aliases: ['pokertourney', 'pk', 'pt'],
  async execute(message, args) {
    const hostId = message.author.id;
    const fee = parseAmount(args[0]);
    if (isNaN(fee) || fee <= 0) return message.channel.send({ embeds: [error('set a buy-in — e.g. `v pokertournament 100k`')] });
    const bal = db.getBalance(hostId);
    if (bal < fee) return message.channel.send({ embeds: [error(`you need **${fee.toLocaleString()}** ${config.currency} to buy in (you have **${bal.toLocaleString()}**)`)] });

    const entrants = [{ userId: hostId, hand: dealHand() }];
    db.addBalance(hostId, -fee);
    db.addGambled(hostId, fee);

    const joinBtn = new ButtonBuilder().setCustomId('pk_join').setLabel('Buy In').setStyle(ButtonStyle.Primary).setEmoji('♠️');
    const row = new ActionRowBuilder().addComponents(joinBtn);

    const buildEmbed = (statusLine) => embed('♠️ Poker Tournament', [
      ['Buy-in', `**${fee.toLocaleString()}** ${config.currency}`],
      ['Table', `${entrants.length}/${MAX_SEATS}`],
      ['', entrants.map(e => `🎴 ${e.hand.map(cardStr).join(' ')} — <@${e.userId}>`).join('\n')],
      ['', statusLine],
    ], 0x2ecc71);

    const msg = await message.channel.send({ embeds: [buildEmbed(`**${Math.floor(JOIN_TIME / 1000)}s** to buy in — hit **Buy In**!`)], components: [row] });

    const filter = i => i.customId === 'pk_join' && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: JOIN_TIME });

    col.on('collect', async (i) => {
      const pid = i.user.id;
      if (entrants.some(e => e.userId === pid)) {
        return i.reply({ embeds: [error('you already bought in to this tournament')], ephemeral: true });
      }
      if (entrants.length >= MAX_SEATS) {
        return i.reply({ embeds: [error('the table is full — 9 players max')], ephemeral: true });
      }
      const pBal = db.getBalance(pid);
      if (pBal < fee) {
        return i.reply({ embeds: [error(`you need **${fee.toLocaleString()}** ${config.currency} (you have **${pBal.toLocaleString()}**)`)], ephemeral: true });
      }
      db.addBalance(pid, -fee);
      db.addGambled(pid, fee);
      entrants.push({ userId: pid, hand: dealHand() });
      await i.update({ embeds: [buildEmbed(entrants.length >= MAX_SEATS ? 'table full — starting…' : `**${Math.max(0, Math.floor((col.endTime - Date.now()) / 1000))}s** to buy in — hit **Buy In**!`)], components: [row] }).catch(() => {});
      if (entrants.length >= MAX_SEATS) col.stop('full');
    });

    col.on('end', async () => {
      if (entrants.length < 2) {
        db.addBalance(hostId, fee);
        return msg.edit({ embeds: [embed('♠️ Tournament Cancelled', [['', 'nobody else bought in — your buy-in was refunded']], 0xed4245)], components: [] }).catch(() => {});
      }
      const rated = entrants.map(e => ({ ...e, score: evalHand(e.hand) }));
      const sorted = rated.sort((a, b) => compareHands(b.score, a.score));
      const winner = sorted[0];
      const pool = entrants.length * fee;
      const winnings = Math.floor(pool * 0.9);
      db.addBalance(winner.userId, winnings);

      const tableLines = sorted.map((e, idx) => `${idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '▫️'} <@${e.userId}> — ${e.hand.map(cardStr).join(' ')} **(${HAND_NAMES[e.score.cat]})**`).join('\n');
      await msg.edit({ embeds: [embed('♠️ Poker Tournament Results', [
        ['Champion', `<@${winner.userId}> — **${HAND_NAMES[winner.score.cat]}** takes **${winnings.toLocaleString()}** ${config.currency}!`],
        ['Pool', `**${pool.toLocaleString()}** ${config.currency} (10% house cut)`],
        ['Table', tableLines.slice(0, 3900)],
      ], 0x2ecc71)], components: [] }).catch(() => {});
      message.channel.send(`♠️ **<@${winner.userId}>** won the poker tournament with **${HAND_NAMES[winner.score.cat]}** — took **${winnings.toLocaleString()}** ${config.currency}!`).catch(() => {});
    });
  },
};