const db = require('../db');
const config = require('../config');
const { embed, error } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const activeGames = new Map();
const MAX_STEPS = 10;

function round2(n) { return Math.round(n * 100) / 100; }

// Effective current multiplier bank. `mult` is tracked on the game because
// deep-row events modify it transiently; mods derive base growth from the DB.
function currentMult(game) {
  return game.mult;
}

// Preview of the next row's multiplier (base growth, no event surprise).
function previewMult(game) {
  const grow = db.gardenRowGrowth(game.mods, game.completed);
  return round2(game.mult * grow);
}

function computeContainer(game, extraSteps, multOverride) {
  const m = multOverride || currentMult(game);
  const profit = Math.floor(game.bet * (m - 1));
  const paid = Math.floor(profit * db.getBalanceFactor(game.userId));
  const total = game.bet + paid;
  return { m, profit, paid, total };
}

function buildButtons(game) {
  const ended = !game.active;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sg_next').setEmoji('🌱').setLabel('Next row').setStyle(ButtonStyle.Success).setDisabled(ended),
    new ButtonBuilder().setCustomId('sg_cash').setEmoji('💰').setLabel('Sell').setStyle(ButtonStyle.Secondary).setDisabled(ended)
  );
  return [row];
}

function buildContainer(game, outcome) {
  const mods = game.mods;
  const maxSteps = mods.maxSteps;
  const lines = [];
  lines.push(`🌻 <@${game.userId}>'s snail finished planting the garden${game.testMode ? ' [TEST]' : ''}!`);
  lines.push(`Gardener: **${mods.runnerEmoji} ${mods.runnerName}**   Bet: \`${game.bet.toLocaleString()}\`   Steps: \`${game.completed}/${maxSteps}\``);
  const failChance = game.completed >= maxSteps ? '—' : db.gardenFailAt(mods, game.completed).toFixed(2) + '%';
  lines.push(`Failure Chance (next row): \`${failChance}\``);
  if (outcome) {
    lines.push('', outcome);
  } else {
    if (game.completed > 0) {
      const cur = computeContainer(game, 0);
      const cut = db.getBalanceFactor(game.userId) < 1 ? ` (real **${cur.m.toFixed(2)}×** after balance cut)` : '';
      lines.push(`Cash Out: \`${cur.total.toLocaleString()} (${cur.m.toFixed(2)}×)\`${cut}`);
    }
    if (game.completed < maxSteps) {
      const nxt = computeContainer(game, 0, previewMult(game));
      lines.push(`Next: \`${nxt.total.toLocaleString()} (${nxt.m.toFixed(2)}×)\``);
    }
    if (game.completed >= maxSteps) lines.push('The garden is fully planted!');
    const parked = '🌻'.repeat(game.completed);
    const remaining = '🟩'.repeat(maxSteps - game.completed);
    if (game.outcomeLine) lines.push('', game.outcomeLine);
    lines.push('', `${parked}${remaining || '🟨'}`);
    lines.push('plant a row to grow the multiplier — failure ends the game');
  }
  const color = outcome ? (outcome.includes('refunded') || outcome.includes('sold') ? 0x57f287 : 0xed4245) : 0x2b2d31;
  return { embeds: [embed('🌻 Snail Garden', [['', lines.join('\n')]], color)], components: buildButtons(game) };
}

// Wrap a finished run: record stats/xp/achievements and build the notice lines.
function wrapRun(game, cashed, won, catches) {
  const rec = db.recordGardenResult(game.userId, { bet: game.bet, rows: game.completed, cashed, won, catches });
  const notes = [];
  if (rec.added > 0) {
    const cap = rec.capped ? ' *(daily xp cap hit)*' : '';
    notes.push(`🌿 **+${rec.added}** garden xp (level **${rec.level}**)${cap}`);
  }
  if (rec.leveledUp) notes.push(`⬆️ **Garden level ${rec.level}!** (+${rec.level * 5000} coins)`);
  if (rec.achievements.length) notes.push(`🏅 achievements: **${rec.achievements.map(k => k.replace(/_/g, ' ')).join(', ')}**`);
  return notes;
}

module.exports = {
  name: 'snailgarden',
  helpCategory: 'Games',
  helpArgs: '<amount>',
  description: 'plant rows step by step — cash out before a row fails',
  aliases: ['sg', 'sgarden', 'gardenbet'],
  execute(message, args) {
    try {
      const { amount, error: betError } = db.parseBet(message.author.id, args[0]);
      if (betError) return message.channel.send({ embeds: [error(betError)] });

      const user = db.ensureUser(message.author.id);
      if (user.balance < amount) return message.channel.send({ embeds: [error('not enough money')] });
      if (activeGames.has(message.author.id)) return message.channel.send({ embeds: [error('you already have an active snail garden')] });

      db.addBalance(message.author.id, -amount);

      const mods = db.gardenMods(message.author.id);
      const game = { bet: amount, completed: 0, active: true, testMode: false, userId: message.author.id, username: message.author.username, mods, mult: 1, gambled: false };
      activeGames.set(message.author.id, game);

      message.channel.send(buildContainer(game)).then(msg => {
        if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
        setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
        col.on('collect', async (i) => {
          if (!game.active) { await i.deferUpdate().catch(() => {}); return; }
          if (i.customId === 'sg_cash') {
            game.active = false; activeGames.delete(message.author.id);
            // An untouched garden (0 rows planted) is NOT a run: refund it like
            // the timeout path so enter-and-sell spam can never farm xp,
            // levels, achievements, titles or stats at zero risk at ANY stake.
            if (game.completed === 0) {
              db.addBalance(message.author.id, game.bet);
              game.outcome = 'You refunded the untouched garden — plant a row for the run to count, then sell.';
              return i.update(buildContainer(game, game.outcome)).catch(() => {});
            }
            const cur = computeContainer(game, 0);
            const paid = db.payWin(message.author.id, cur.profit, game.bet);
            const total = game.bet + paid;
            const cut = paid < cur.profit ? ` — got **${(total / game.bet).toFixed(2)}×** (balance cut)` : '';
            const notes = wrapRun(game, total, true, 0);
            game.outcome = `Sold the garden for **${total.toLocaleString()}** ${config.currency} (+**${paid}**)${cut}\n${notes.join('\n')}`;
            return i.update(buildContainer(game, game.outcome)).catch(() => {});
          }
          if (i.customId === 'sg_next') {
            // the wager only counts the moment a row is actually attempted —
            // a 0-row immediate sell (or a timeout) takes no risk, so it must
            // not feed gambling/wager stats, the weekly board or pass xp.
            if (!game.gambled) { game.gambled = true; db.addGambled(message.author.id, game.bet); }
            const mods = game.mods;
            const event = db.gardenEvent(game.completed);
            const grow = db.gardenRowGrowth(mods, game.completed) * (1 + (event ? event.grow : 0));
            const chance = Math.min(95, Math.max(1, db.gardenFailAt(mods, game.completed) + (event ? event.fail : 0)));
            const fail = Math.random() * 100 < chance;
            if (fail) {
              game.active = false; activeGames.delete(message.author.id);
              let catches = 0;
              // safety net: a deep-row failure can be caught and sold at current value
              if (game.completed >= mods.deepDepth && mods.net > 0 && Math.random() * 100 < mods.net * 4) {
                catches = 1;
                const cur = computeContainer(game, 0);
                const paid = db.payWin(message.author.id, cur.profit, game.bet);
                const total = game.bet + paid;
                const notes = wrapRun(game, total, true, catches);
                game.completed++;
                game.outcome = `🕸️ **Safety net caught it!** The garden was saved and sold for **${total.toLocaleString()}** ${config.currency} (+**${paid}**)\n${notes.join('\n')}`;
                return i.update(buildContainer(game, game.outcome)).catch(() => {});
              }
              let refund = 0;
              refund = db.getInsuranceRefund(message.author.id, game.bet);
              if (refund > 0) db.addBalance(message.author.id, refund);
              game.completed++;
              wrapRun(game, 0, false, catches);
              game.outcome = `The garden failed to plant next row! Lost **${game.bet.toLocaleString()}** ${config.currency}${refund > 0 ? ` (🛡️ **${refund.toLocaleString()}** refunded)` : ''}`;
              return i.update(buildContainer(game, game.outcome)).catch(() => {});
            }
            game.completed++;
            game.mult = round2(game.mult * grow);
            if (game.completed >= mods.maxSteps) {
              game.active = false; activeGames.delete(message.author.id);
              const cur = computeContainer(game, 0);
              const paid = db.payWin(message.author.id, cur.profit, game.bet);
              const total = game.bet + paid;
              const notes = wrapRun(game, total, true, 0);
              game.outcome = `Garden fully planted! You sold for **${total.toLocaleString()}** ${config.currency} (+**${paid}**)\n${notes.join('\n')}`;
              return i.update(buildContainer(game, game.outcome)).catch(() => {});
            }
            if (event) game.outcomeLine = `${event.emoji} **${event.name}!** ${event.desc}`;
            i.update(buildContainer(game)).catch(() => {});
          }
        });
        col.on('end', () => {
          if (game.active) {
            game.active = false; activeGames.delete(message.author.id);
            db.addBalance(message.author.id, game.bet); // refund an untouched garden
            msg.edit({ embeds: [embed('🌻 Snail Garden', [['', '⏰ Game timed out (no moves for 5 min) — your bet was **refunded**.']], 0x2b2d31)], components: [] }).catch(() => {});
          }
        });
      }).catch(err => {
        activeGames.delete(message.author.id);
        db.addBalance(message.author.id, amount);
        console.error('snailgarden send error:', err);
        message.channel.send({ embeds: [error('failed to start snail garden')] }).catch(() => {});
      });
    } catch (err) {
      activeGames.delete(message.author.id);
      if (amount) db.addBalance(message.author.id, amount);
      console.error('snailgarden execute error:', err);
      message.channel.send({ embeds: [error('something went wrong starting snail garden')] }).catch(() => {});
    }
  },
};