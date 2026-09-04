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
const intel = require('./intel');
const INTEL_KEY = process.env.INTEL_KEY || config.intelKey || null;
function intelAuth(u) {
  return !INTEL_KEY || u.searchParams.get('key') === INTEL_KEY;
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (u.pathname === '/intel' && req.method === 'GET') {
    if (!intelAuth(u)) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'forbidden' })); return; }
    const since = u.searchParams.get('since') || '0';
    const data = intel.getSince(since);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events: data, now: Date.now(), stats: intel.stats() }));
    return;
  }
  if (u.pathname === '/intel' && req.method === 'POST') {
    if (!intelAuth(u)) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'forbidden' })); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const added = intel.merge(parsed.events || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ added, stats: intel.stats() }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad json' }));
      }
    });
    return;
  }
  if (u.pathname === '/restore') {
    const { restore } = require('./backup');
    restore().then(r => {
      const db2 = require('./db');
      db2.init().then(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`restore=${r}`);
      }).catch(e => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`db init error: ${e.message}`);
      });
    }).catch(e => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`restore error: ${e.message}`);
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`ok v${version} commit=${process.env.RENDER_GIT_COMMIT || process.env.GIT_SHA || 'unknown'}`);
});
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
  const restored = await restore();
  console.log(`restore result: ${restored}`);
  await db.init();
  db.cleanupPendingBattles();
  db.repairNaNBalances();
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
      activities: [{ name: `v${version} | /marlboro | ${config.prefixes[0]} help` }],
      status: 'online',
    });



    // Update announcement check (after db is ready)
    const ver2 = version || '1.0.0';
    if (!db.wasNotified(`v${ver2}`)) {
      if (updateMsg) {
        postUpdateAnnouncement(client, updateMsg, `v${ver2}`).then(sent => {
          const channels = db.getAllUpdateChannels();
          if (sent === channels.length) db.markNotified(`v${ver2}`);
          else console.error(`update announcement partially sent (${sent}/${channels.length}) — will retry next boot`);
        });
      } else {
        db.markNotified(`v${ver2}`);
      }
    }
  });



  setInterval(() => {
    const expired = db.getExpiredSubs();
    for (const sub of expired) {
      db.removePerk(sub.user_id, sub.perk);
    }
  }, 3600000);

  // backup every 5 min + restore on boot (keeps data alive across Render restarts)
  const { backup } = require('./backup');
  const doBackup = () => {
    console.log('backup: starting scheduled backup...');
    backup().then(() => console.log('backup: completed')).catch(e => console.error('BACKUP FAILED:', e && e.message));
  };
  setInterval(doBackup, 300000);
  setTimeout(doBackup, 5000);

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


    for (const guild of client.guilds.cache.values()) {
      const boss = db.getBoss(guild.id);
      if (boss && (boss.hp <= 0 || Math.floor(Date.now() / 1000) > boss.ends_at)) {
        const res = db.resolveBoss(guild.id);
        if (res && res.payouts && res.payouts.length) console.log(`[boss] ${res.species} resolved in ${guild.id}: ${res.payouts.length} payouts`);
      }
    }

    // giveaway sweep: draw winners for expired giveaways
    const expiredGw = db.getExpiredGiveaways(Math.floor(Date.now() / 1000));
    for (const gwId of expiredGw) {
      const g = db.getGiveaway(gwId);
      if (!g || !g.entries.length) {
        db.finishGiveaway(gwId, '__none__');
        continue;
      }
      const winner = g.entries[Math.floor(Math.random() * g.entries.length)];
      db.addBalance(winner, g.prize);
      db.finishGiveaway(gwId, winner);
      console.log(`[gw] giveaway ${gwId} won by ${winner} (${g.prize} coins)`);
      client.channels.fetch(g.channel_id).then(ch => {
        if (!ch || typeof ch.edit !== 'function') return;
        ch.messages.fetch(g.message_id).then(msg => {
          msg.edit({
            embeds: [embed('🎉 Giveaway', [
              ['Winner', `<@${winner}> 🎉`],
              ['Prize', `**${g.prize.toLocaleString()}** ${config.currency}`],
              ['Entries', `${g.entries.length} people entered`],
            ], 0xfee75c)],
            components: [],
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    }
  }, 60000);



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



// track who owns each interactive message — only they can click the buttons
const interactionOwners = new Map();
global._interactionOwners = interactionOwners;

client.on('interactionCreate', (i) => {
  if (!i.customId || !i.isButton()) return;
  // lock interactions to the person who ran the command
  const ownerId = interactionOwners.get(i.message?.id);
  if (ownerId && i.user.id !== ownerId) {
    return i.reply({ content: 'this isnt your button — run the command yourself!', ephemeral: true });
  }
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
  intel.recordMessage(message);
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

// graceful shutdown — wait for active games to finish before exiting
let shuttingDown = false;
const activeGames = new Set();
function trackGame(id) { activeGames.add(id); }
function untrackGame(id) { activeGames.delete(id); }
global._activeGames = { track: trackGame, untrack: untrackGame, list: activeGames };

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${signal}] shutting down — waiting for ${activeGames.size} active game(s)...`);
  const deadline = Date.now() + 30000;
  while (activeGames.size > 0 && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('[shutdown] backing up...');
  try { await Promise.race([backup(), new Promise(r => setTimeout(r, 10000))]); } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
