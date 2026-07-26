const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands, handleMessage } = require('./utils/commandHandler');
const config = require('./config');
const db = require('./db');
const { embed } = require('./utils/embed');
const http = require('http');
const path = require('path');
const { version } = require('./package.json');
const { setClient: setLogClient } = require('./utils/logger');

if (!config.token) {
  console.error('no token set — set TOKEN env var or put it in config.json');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
server.on('error', () => { console.error('port in use — another instance running, exiting'); process.exit(1); });
server.listen(PORT);
global._server = server;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

loadCommands();

async function start() {
  const { restore } = require('./backup');
  await restore();
  await db.init();
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
    activities: [{ name: `${config.prefixes[0]} help | ${client.guilds.cache.size} servers` }],
    status: 'online',
  });

  const { backup } = require('./backup');
  setInterval(() => backup().catch(() => {}), 3600000);
  setTimeout(() => backup().catch(() => {}), 10000);

  setInterval(() => {
    const expired = db.getExpiredSubs();
    for (const sub of expired) {
      db.removePerk(sub.user_id, sub.perk);
    }
  }, 3600000);

  const fs = require('fs');
  const ver = version || '1.0.0';
  const verFlag = path.join(__dirname, `.notified_v${ver}`);
  if (!fs.existsSync(verFlag)) {
    let updateMsg = '';
    try { updateMsg = fs.readFileSync(path.join(__dirname, 'update_msg.txt'), 'utf8').trim(); } catch {}
    if (updateMsg) {
      const channels = db.getAllUpdateChannels();
      for (const { guild_id, channel_id } of channels) {
        const ch = client.channels.cache.get(channel_id);
        if (ch) ch.send({ embeds: [embed('📢 Bot Update', [
          ['Version', `v${ver}`],
          ['What\'s New', updateMsg],
          ['Uptime', 'Fresh deploy — check `v version` for details'],
        ], 0x5865f2)] }).catch(() => {});
      }
    }
    fs.writeFileSync(verFlag, 'done');
  }

  const crFlag = path.join(__dirname, '.notified_cr_update');
  if (!fs.existsSync(crFlag)) {
    const crHolders = db.getPerkHolders('custom_role');
    for (const uid of crHolders) {
      client.users.fetch(uid).then(u => {
        u.send('**Custom Role perk updated!**\nYou can now set your role yourself:\n`v customrole name | #hexcolor`\n\nExample: `v customrole Cool Guy | #ff0000`\n\nYour existing role will update, or a new one will be created.').catch(() => {});
      }).catch(() => {});
    }
    fs.writeFileSync(crFlag, 'done');
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

    db.addBalance(winner.user_id, prize);
    db.addWon(winner.user_id, prize);
    db.resetLottery();

    const channel = client.channels.cache.find(c => c.name?.includes('lottery') || c.name?.includes('general'));
    if (channel) {
      channel.send({
        embeds: [embed('🎟️ Lottery Winner', [
          ['Winner', `<@${winner.user_id}>`],
          ['Prize', `**${prize}** ${config.currency}`],
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
      const emoji = db.getAutoReactEmoji(message.author.id) || '⭐';
      try { message.react(emoji); } catch {}
    }

  }
});

process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection:', err.message);
});
process.on('uncaughtException', (err) => {
  console.error('uncaught exception:', err.message);
});
