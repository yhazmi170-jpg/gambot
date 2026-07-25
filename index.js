const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands, handleMessage } = require('./utils/commandHandler');
let config;
try { config = require('./config.json'); } catch { config = require('./config.example.json'); }
if (process.env.TOKEN) config.token = process.env.TOKEN;
const db = require('./db');
const { embed } = require('./utils/embed');

if (!config.token) {
  console.error('no token set — set TOKEN env var or put it in config.json');
  process.exit(1);
}

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
  await db.init();
  await client.login(config.token);
}

start();

client.on('ready', () => {
  console.log(`logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: `${config.prefixes[0]} help | ${client.guilds.cache.size} servers` }],
    status: 'online',
  });

  setInterval(() => {
    const expired = db.getExpiredSubs();
    for (const sub of expired) {
      db.removePerk(sub.user_id, sub.perk);
    }
  }, 3600000);

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
    if (perks.find(p => p.perk === 'badge')) {
      try { message.react('🏅'); } catch {}
    }
  }
});

process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection:', err.message);
});
