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
const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
server.listen(PORT);
global._server = server;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
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

client.on('ready', () => {
  console.log(`logged in as ${client.user.tag}`);
  setLogClient(client);
  const fs2 = require('fs');
  const updateMsg = (() => { try { return fs2.readFileSync(path.join(__dirname, 'update_msg.txt'), 'utf8').trim(); } catch { return ''; } })();
  const startupMsg = updateMsg ? `✅ **Bot Restarted**\n\`\`\`\n${updateMsg}\n\`\`\`` : '✅ bot restarted successfully';
  client.users.fetch('536278876247162882').then(u => u.send(startupMsg).catch(() => {})).catch(() => {});
  client.user.setPresence({
    activities: [{ name: `v${version} | /ravine | ${config.prefixes[0]} help` }],
    status: 'online',
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

  const fs = require('fs');
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
    db.resetLottery();

    const channel = client.channels.cache.find(c => c.name?.includes('lottery') || c.name?.includes('general'));
    if (channel) {
      channel.send({
        embeds: [embed('🎟️ Lottery Winner', [
          ['Winner', `<@${winner.user_id}>`],
          ['Prize', `**${paid}** ${config.currency}`],
          ['Total Pot', `**${pot}** ${config.currency}`],
        ], 0xfee75c)],
      });
    }
  }, config.lotteryInterval || 3600000);
});

client.on('interactionCreate', (i) => {
  if (!i.customId || !i.isButton()) return;
  if (i.customId.startsWith('shop_')) {
    require('./commands/shop').handleInteraction(i);
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
