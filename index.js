const { Client, GatewayIntentBits, Partials } = require('discord.js');const { loadCommands, handleMessage } = require('./utils/commandHandler');
const config = require('./config');
const db = require('./db');
const { embed, updateEmbed } = require('./utils/embed');
const http = require('http');
const path = require('path');
const { version } = require('./package.json');
const { setClient: setLogClient } = require('./utils/logger');

if (!config.token) {
  console.error('no token set — set TOKEN env var or put it in config.json');
  process.exit(1);
}

// atomic single-instance lock — exit if another gambot is already running
const fs = require('fs');
const lockFile = path.join(__dirname, '.gambot.lock');
function acquireLock() {
  try {
    const fd = fs.openSync(lockFile, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (e) {
    if (e.code === 'EEXIST') {
      let stale = true;
      try {
        const oldPid = parseInt(fs.readFileSync(lockFile, 'utf8').trim());
        if (oldPid) {
          try {
            const cmd = fs.readFileSync(`/proc/${oldPid}/cmdline`, 'utf8');
            if (cmd.includes('index.js')) {
              process.kill(oldPid, 0);
              console.log('another instance is running, exiting');
              process.exit(0);
            }
          } catch {}
        }
      } catch {}
      try { fs.unlinkSync(lockFile); } catch {}
      return acquireLock();
    }
    return false;
  }
}
if (!acquireLock()) { console.error('could not acquire lock'); process.exit(1); }
process.on('exit', () => { try { fs.unlinkSync(lockFile); } catch {} });

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`ok v${version} commit=${process.env.RENDER_GIT_COMMIT || process.env.GIT_SHA || 'unknown'}`);
});
server.listen(PORT);
global._server = server;

let bootNotified = false;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

/** Post an update announcement to every configured update channel. Returns # channels that got it. */
async function postUpdateAnnouncement(client, updateMsg, ver) {
  const channels = db.getAllUpdateChannels();
  let sent = 0;
  for (const { channel_id } of channels) {
    try {
      const ch = await client.channels.fetch(channel_id).catch(() => null);
      if (ch && typeof ch.send === 'function') {
        await ch.send({ embeds: [updateEmbed(ver, updateMsg, 'Fresh deploy — check `v version` for details')] });
        sent++;
      }
    } catch (e) { console.error('update announcement send failed:', channel_id, e && e.message); }
  }
  return sent;
}

loadCommands();

async function start() {
  const { restore } = require('./backup');
  await restore();
  await db.init();
  db.cleanupPendingBattles();
  await client.login(config.token);
}

start();

  // Use once instead of on to prevent duplicate ready events
  client.once('ready', () => {
    console.log(`logged in as ${client.user.tag}`);
    setLogClient(client);
    const fs2 = require('fs');
    const updateMsg = (() => { try { return fs2.readFileSync(path.join(__dirname, 'update_msg.txt'), 'utf8').trim(); } catch { return ''; } })();
    client.users.fetch('536278876247162882').then(u => {
      const msg = `✅ Bot Restarted\n\`\`\`\n${updateMsg || 'no updates'}\n\`\`\``;
      u.send(msg).catch(() => {});
    }).catch(() => {});
    client.user.setPresence({
      activities: [{ name: `v${version} | /ravine | ${config.prefixes[0]} help` }],
      status: 'online',
    });
  });

  const { backup } = require('./backup');
  const doBackup = () => backup().catch(e => console.error('BACKUP FAILED:', e && e.message, e && e.stack || ''));
  setInterval(doBackup, 60000);
  setTimeout(doBackup, 10000);

  setInterval(() => {
    const expired = db.getExpiredSubs();
    for (const sub of expired) {
      db.removePerk(sub.user_id, sub.perk);
    }
  }, 3600000);

  // v1.7.0: hourly vault interest
  setInterval(() => {
    const gain = db.accrueVaultInterest();
    if (gain > 0) console.log(`vault interest accrued: +${gain}`);
  }, 3600000);

  function formatEventDuration(sec) {
    const m = Math.floor(sec / 60);
    if (m < 60) return `${m} minutes`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h} hour${h > 1 ? 's' : ''}`;
  }

  // v1.7.0: random server events on an irregular schedule (not clockwork)
  const fireEvent = () => {
    const ev = db.startRandomEvent();
    let channels = db.getAllEventChannels();
    if (!channels.length) channels = db.getAllUpdateChannels(); // fallback so events aren't missed
    const rain = ev.apply === 'rain' ? db.applyRain(ev.key) : null;
    const rainNote = rain ? ` — everyone got the payout instantly` : '';
    for (const { channel_id } of channels) {
      client.channels.fetch(channel_id).then(ch => {
        if (ch && typeof ch.send === 'function') {
          ch.send({ embeds: [embed(`📢 Random Event: ${ev.emoji || '🎉'} ${ev.name}`, [
            ['Effect', `${ev.desc}${rainNote}`],
            ['Duration', ev.apply === 'rain' ? 'instant payout' : formatEventDuration(ev.duration)],
            ['', `no action needed — it applies automatically across the server`],
          ], 0x9b59b6)] }).catch(() => {});
        }
      }).catch(() => {});
    }
  };
  // irregular interval: mostly 15-40 min, occasionally 8-12 min or 45-65 min (never metronomic)
  const eventDelay = () => {
    const r = Math.random();
    let mins;
    if (r < 0.2) mins = 8 + Math.random() * 4;          // 20%: quick burst  8-12 min
    else if (r < 0.75) mins = 15 + Math.random() * 25;   // 55%: normal      15-40 min
    else mins = 45 + Math.random() * 20;                  // 25%: long gap    45-65 min
    return Math.floor(mins * 60000);
  };
  const startEventTimer = () => setTimeout(() => { fireEvent(); startEventTimer(); }, eventDelay());
  startEventTimer();

  // v1.7.0: expire auctions + clean up dead/expired boss raids
  setInterval(() => {
    const ended = db.cleanupExpiredAuctions();
    if (ended > 0) console.log(`[auction] ${ended} auction(s) ended`);
    const expiredBountyRefund = db.pruneExpiredBounties();
    if (expiredBountyRefund > 0) console.log(`[bounty] expired bounty refunded ${expiredBountyRefund}`);
    const lbWeek = db.currentLbWeek();
    const lbPosted = db.getLbState('week');
    if (lbPosted && lbPosted !== String(lbWeek)) {
      const prev = Number(lbPosted);
      const res = db.finalizeWeeklyLb(prev);
      if (res.paid.length) console.log(`[lb] week ${prev} rewards paid: ${res.paid.map(p => `${p.user_id}:${p.reward}`).join(', ')}`);
      const channels = db.getAllLbChannels();
      if (channels.length) {
        const lines = res.list.slice(0, 10).map((x, i) => `${i < 3 ? ['🥇', '🥈', '🥉'][i] : '▫️'} **${x.net >= 0 ? '+' : ''}${x.net.toLocaleString()}** <@${x.user_id}> (bet ${x.amount.toLocaleString()})`).join('\n');
        const rewardNote = res.paid.map(p => `🥇/🥈/🥉`.split('/')[p.place - 1] + ` <@${p.user_id}> won **${p.reward.toLocaleString()}**`).join('\n');
        for (const { channel_id } of channels) {
          client.channels.fetch(channel_id).then(ch => {
            if (ch && typeof ch.send === 'function') ch.send({ embeds: [embed('🏆 Weekly Gambling Leaderboard', [
              ['Top Gamblers', lines || 'no bets this week'],
              ['Rewards', rewardNote || 'nobody qualified'],
              ['', "this week's board resets — run v glb to view"],
            ], 0xf1c40f)] }).catch(() => {});
          }).catch(() => {});
        }
      }
      db.setLbState('week', String(lbWeek));
    }
    if (!lbPosted) db.setLbState('week', String(lbWeek));
    // v1.8.0: travelling merchant arrival
    if (Math.floor(Date.now() / 1000) >= db.getNextMerchantArrival()) {
      const arrivals = db.refreshMerchant();
      console.log(`[merchant] new stock — ${arrivals.slots.length} items, leaves at ${new Date(arrivals.next_at * 1000).toISOString()}`);
      const mc = db.getAllEventChannels();
      for (const { channel_id } of mc) {
        client.channels.fetch(channel_id).then(ch => {
          if (ch && typeof ch.send === 'function') ch.send('🛍️ **The travelling merchant has arrived!** Rare stock up for grabs — `v merchant`, first come first served!').catch(() => {});
        }).catch(() => {});
      }
    }
    // v1.8.0: clan wars auto-resolve (pay winner if a side fought, else refund both)
    const warResults = db.resolveClanWars();
    for (const r of warResults) {
      console.log(`[clanwar] ${r.code} settled — winner=${r.winner || 'none'} pot=${r.pot} (${r.atPower} vs ${r.dPower})`);
      (async () => {
        try {
          const ch = await client.channels.fetch(r.w.channel_id);
          const msg = await ch.messages.fetch(r.w.msg_id);
          const aName = (db.getClan(r.w.attacker) || {}).name || 'unknown';
          const dName = (db.getClan(r.w.defender) || {}).name || 'unknown';
          const fields = r.winner
            ? [['Result', `**${aName}** (${r.atPower.toLocaleString()}) vs **${dName}** (${r.dPower.toLocaleString()})`], ['🏆 Winner', `**${(db.getClan(r.winner) || {}).name || '?'}** — takes the pot of **${r.pot.toLocaleString()}** ${config.currency}!`], ['', 'treasury payout deposited']]
            : [['Result', `**${aName}** (${r.atPower.toLocaleString()}) vs **${dName}** (${r.dPower.toLocaleString()})`], ['⚖️', 'no clear victory — both stakes refunded']];
          await msg.edit({ embeds: [embed('⚔️ Clan War — Settled', fields, 0x2ecc71)], components: [] });
        } catch (e) { console.error('[clanwar] resolve post failed', e.message); }
      })();
    }
    for (const guild of client.guilds.cache.values()) {
      const boss = db.getBoss(guild.id);
      if (boss && (boss.hp <= 0 || Math.floor(Date.now() / 1000) > boss.ends_at)) {
        const res = db.resolveBoss(guild.id);
        if (res && res.payouts && res.payouts.length) console.log(`[boss] ${res.species} resolved in ${guild.id}: ${res.payouts.length} payouts`);
      }
    }
  }, 60000);

  // v1.7.0: draw + announce giveaways that ended — runs from persisted DB so it
  // works even if the bot restarted mid-giveaway (winner is ALWAYS drawn + paid)
  const finalizeGiveaway = async (mid) => {
    const g = db.getGiveaway(mid);
    if (!g) return;
    const eligible = g.entries.filter(id => id !== g.host_id);
    const ch = await client.channels.fetch(g.channel_id).catch(() => null);
    if (!eligible.length) {
      db.addBalance(g.host_id, g.prize);
      db.finishGiveaway(mid, 'REFUND');
      if (ch && typeof ch.send === 'function') ch.send({ embeds: [embed('🎉 Giveaway Ended', [
        ['Host', `<@${g.host_id}>`],
        ['Prize', `**${g.prize.toLocaleString()}** ${config.currency}`],
        ['Result', 'nobody entered — prize returned to the host'],
      ], 0xed4245)] }).catch(() => {});
      return;
    }
    const winnerId = eligible[Math.floor(Math.random() * eligible.length)];
    db.addBalance(winnerId, g.prize);
    db.finishGiveaway(mid, winnerId);
    const status = `🎉 **Winner:** <@${winnerId}> — they won **${g.prize.toLocaleString()}** ${config.currency}!`;
    if (ch && typeof ch.fetch) {
      ch.messages.fetch(mid).then(m => m.edit({ embeds: [embed('🎉 Giveaway Ended', [
        ['Host', `<@${g.host_id}>`],
        ['Prize', `**${g.prize.toLocaleString()}** ${config.currency}`],
        ['Entries', `${g.entries.length}`],
        ['Winner', `<@${winnerId}>`],
      ], 0x57f287)], components: [] }).catch(() => {})).catch(() => {});
      ch.send(`🎉 <@${winnerId}> won the giveaway for **${g.prize.toLocaleString()}** ${config.currency}!`).catch(() => {});
    }
    client.users.fetch(winnerId).then(u => u.send(`🎉 **You won a giveaway!** You got **${g.prize.toLocaleString()}** ${config.currency}. Congrats!`).catch(() => {})).catch(() => {});
  };
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const mid of db.getExpiredGiveaways(now)) finalizeGiveaway(mid);
  }, 30000);
  setTimeout(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const mid of db.getExpiredGiveaways(now)) finalizeGiveaway(mid);
  }, 5000);

  const ver = version || '1.0.0';
  if (!db.wasNotified(`v${ver}`)) {
    let updateMsg = '';
    try { updateMsg = fs.readFileSync(path.join(__dirname, 'update_msg.txt'), 'utf8').trim(); } catch {}
    if (updateMsg) {
      postUpdateAnnouncement(client, updateMsg, `v${ver}`).then(sent => {
        const channels = db.getAllUpdateChannels();
        if (sent === channels.length) db.markNotified(`v${ver}`);
        else console.error(`update announcement partially sent (${sent}/${channels.length}) — will retry next boot`);
      });
    } else {
      db.markNotified(`v${ver}`);
    }
  }

  if (!db.wasNotified('custom_role_update')) {
    const crHolders = db.getPerkHolders('custom_role');
    for (const uid of crHolders) {
      client.users.fetch(uid).then(u => {
        u.send('**Custom Role perk updated!**\nYou can now set your role yourself:\n`v customrole name <name>` · `v customrole color #hex` · `v customrole name | #hex`\n\nExample: `v customrole Cool Guy | #ff0000`\n\nYour existing role will update, or a new one will be created.').catch(() => {});
      }).catch(() => {});
    }
    db.markNotified('custom_role_update');
  }

  setInterval(() => {
    const ticketUsers = db.getLottery();
    for (const uid of client.users.cache.keys()) {
      if (db.hasPerk(uid, 'lottery_ticket')) db.addTicket(uid, 1);
    }

    const total = db.totalTickets().total;
    if (total <= 0) return;

    const allEntries = db.getLottery();
    if (!allEntries.length) return;

    const winner = allEntries[Math.floor(Math.random() * allEntries.length)];
    const pot = total * 10;
    const prize = Math.floor(pot * config.lotteryCut);
    const paid = db.payWin(winner.user_id, prize);
    const eventMult = db.eventMult('winMult');
    db.resetLottery();

    const channel = client.channels.cache.find(c => c.name?.includes('lottery') || c.name?.includes('general'));
    if (channel) {
      channel.send({
        embeds: [embed('🎟️ Lottery Winner', [
          ['Winner', `<@${winner.user_id}>`],
          ['Prize', `**${paid}** ${config.currency}${eventMult > 1 ? ` (${eventMult}x event bonus!)` : ''}`],
          ['Total Pot', `**${pot}** ${config.currency}`],
        ], 0xfee75c)],
      });
    }
  }, config.lotteryInterval || 3600000);

  // animated gradient custom roles — fade each role's color between its two stored colors
  setInterval(() => {
    const gradients = db.getGradientCustomRoles();
    if (!gradients.length) return;
    const now = Date.now();
    for (const g of gradients) {
      const guild = client.guilds.cache.get(g.guildId);
      if (!guild) continue;
      const role = guild.roles.cache.get(g.roleId);
      if (!role) continue;
      // sin wave over ~12s gives a smooth A->B->A ping-pong every ~6s
      const t = (Math.sin((now / 3000) * Math.PI) + 1) / 2; // 0..1
      const r = Math.round(((g.colorA >> 16) & 255) + (((g.colorB >> 16) & 255) - ((g.colorA >> 16) & 255)) * t);
      const g_ = Math.round(((g.colorA >> 8) & 255) + (((g.colorB >> 8) & 255) - ((g.colorA >> 8) & 255)) * t);
      const b = Math.round((g.colorA & 255) + ((g.colorB & 255) - (g.colorA & 255)) * t);
      const color = (r << 16) | (g_ << 8) | b;
      if (role.color === color) continue;
      role.setColor(color).catch(() => {});
    }
  }, 3000);
});

client.on('interactionCreate', (i) => {
  if (!i.customId || !i.isButton()) return;
  if (i.customId.startsWith('shop_')) {
    require('./commands/shop').handleInteraction(i);
    return;
  }
  if (i.customId.startsWith('mer_')) {
    require('./commands/merchant').handleInteraction(i);
    return;
  }
  if (i.customId.startsWith('claninv_')) {
    require('./commands/clan').handleInteraction(i);
    return;
  }
  if (i.customId.startsWith('war_')) {
    require('./commands/clanwar').handleInteraction(i);
    return;
  }
  if (i.customId.startsWith('battle_')) {
    require('./commands/battle').handleInteraction(i);
    return;
  }
  if (i.customId.startsWith('help_')) {
    require('./commands/help').handleInteraction(i);
    return;
  }
  const fallback = setTimeout(() => i.deferUpdate().catch(() => {}), 2500);
  i._ackFallback = fallback;
});

client.on('disconnect', () => console.log('disconnected — will auto-reconnect'));
client.on('reconnecting', () => console.log('reconnecting...'));
client.on('resume', () => console.log('reconnected'));

client.on('messageCreate', (message) => {
  handleMessage(message);
  if (message.author.bot) return;
  const perks = db.getUserPerks(message.author.id);
  if (message.channel.type === 0) {
    const ar = perks.find(p => p.perk === 'auto_react');
    if (ar) {
      const emoji = db.getAutoReactEmoji(message.author.id);
      if (!emoji) return;
      const resolved = resolveEmoji(message, emoji);
      if (resolved) {
        message.react(resolved).catch(err => console.error(`autoreact failed (${emoji}):`, err.message));
      } else {
        console.error(`autoreact: could not resolve emoji "${emoji}" for ${message.author.id} — using ⭐`);
        message.react('⭐').catch(() => {});
      }
    }
  }
});

// Resolve a stored emoji to something message.react() accepts: unicode passes through,
// custom <:name:id> / <a:name:id> is looked up in the guild's emoji cache (fallback: id).
function resolveEmoji(message, emoji) {
  if (!emoji) return '⭐';
  const m = String(emoji).match(/^<a?:([^:]+):(\d+)>$/);
  if (m) {
    const g = message.guild && message.guild.emojis.cache.get(m[2]);
    return g || m[2];
  }
  return emoji;
}

function logCrash(tag, err) {
  const line = `${new Date().toISOString()} [${tag}] ${(err && (err.stack || err.message)) || err}\n`;
  console.error(line);
  try { fs.appendFileSync(path.join(__dirname, 'bot.err'), line); } catch {}
}
process.on('unhandledRejection', (err) => logCrash('UNHANDLED_REJECTION', err));
process.on('uncaughtException', (err) => logCrash('UNCAUGHT_EXCEPTION', err));

// Render free tier has NO persistent disk — ./data is wiped on every deploy/restart.
// Back up the live DB right before exit so nothing newer than the last interval backup is lost.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${signal}] backing up before exit...`);
  try {
    const { backup } = require('./backup');
    await Promise.race([backup(), new Promise(r => setTimeout(r, 15000))]);
    console.log('[shutdown] backup done');
  } catch (e) {
    console.error('[shutdown] backup failed:', e && e.message);
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
