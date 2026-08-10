const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TASKS = [
  { task: 'Say something nice about the person above you', emoji: '💬' },
  { task: 'Post a selfie in the server', emoji: '🤳' },
  { task: 'Tell us your worst joke', emoji: '😂' },
  { task: 'Share your favorite memory', emoji: '💭' },
  { task: 'Whats your biggest fear?', emoji: '😱' },
  { task: 'Describe yourself in 3 words', emoji: '📝' },
  { task: 'Whats your dream job?', emoji: '💼' },
  { task: 'Post your favorite song', emoji: '🎵' },
  { task: 'Whats your hidden talent?', emoji: '🎭' },
  { task: 'If you could have any superpower', emoji: '⚡' },
  { task: 'Whats your biggest regret?', emoji: '😔' },
  { task: 'Describe your perfect day', emoji: '☀️' },
  { task: 'Whats the weirdest food youve eaten?', emoji: '🍽️' },
  { task: 'If you could meet anyone dead or alive', emoji: '👻' },
  { task: 'Whats your guilty pleasure?', emoji: '🤫' },
  { task: 'Post a pic of your pet', emoji: '🐾' },
  { task: 'Whats your favorite movie?', emoji: '🎬' },
  { task: 'Describe your worst date', emoji: '💔' },
  { task: 'Whats your biggest achievement?', emoji: '🏆' },
  { task: 'If you won the lottery what would you buy?', emoji: '💰' },
];

const games = new Map();

module.exports = {
  name: 'toulbonline',
  helpCategory: 'Games',
  helpArgs: '',
  aliases: ['tlbonline', 'tolb', 'tol'],
  description: 'online toulb — start a game others can join, no money reward',
  async execute(message, args) {
    const guildId = message.guild.id;
    if (games.has(guildId)) {
      return message.channel.send({ embeds: [error('theres already an active toulb game in this server')] });
    }

    const players = new Set([message.author.id]);
    games.set(guildId, { players, host: message.author.id, started: false });

    const joinBtn = new ButtonBuilder().setCustomId('toulb_join').setLabel('Join Game').setStyle(ButtonStyle.Success).setEmoji('🎮');
    const startBtn = new ButtonBuilder().setCustomId('toulb_start').setLabel('Start Game').setStyle(ButtonStyle.Primary).setEmoji('▶️');
    const row = new ActionRowBuilder().addComponents(joinBtn, startBtn);

    const msg = await message.channel.send({
      embeds: [embed('🎮 Online Toulb', [
        ['Host', `<@${message.author.id}>`],
        ['Players', `${players.size}/10 — ${[...players].map(id => `<@${id}>`).join(' ')}`],
        ['', '**60s** to join — hit **Join Game**!\nNo money reward — just for fun 🎉'],
      ], 0x9b59b6)],
      components: [row],
    });

    const filter = i => i.customId.startsWith('toulb_') && !i.user.bot;
    const col = msg.createMessageComponentCollector({ filter, time: 60000 });

    col.on('collect', async (i) => {
      const game = games.get(guildId);
      if (!game) return;

      if (i.customId === 'toulb_join') {
        if (game.players.has(i.user.id)) {
          return i.reply({ embeds: [error('you already joined')], ephemeral: true });
        }
        if (game.players.size >= 10) {
          return i.reply({ embeds: [error('game is full (10 max)')], ephemeral: true });
        }
        game.players.add(i.user.id);
        await i.update({
          embeds: [embed('🎮 Online Toulb', [
            ['Host', `<@${game.host}>`],
            ['Players', `${game.players.size}/10 — ${[...game.players].map(id => `<@${id}>`).join(' ')}`],
            ['', '**60s** to join — hit **Join Game**!\nNo money reward — just for fun 🎉'],
          ], 0x9b59b6)],
        }).catch(() => {});
      }

      if (i.customId === 'toulb_start') {
        if (i.user.id !== game.host) {
          return i.reply({ embeds: [error('only the host can start')], ephemeral: true });
        }
        if (game.players.size < 2) {
          return i.reply({ embeds: [error('need at least 2 players')], ephemeral: true });
        }
        game.started = true;
        col.stop('started');
      }
    });

    col.on('end', async (collected, reason) => {
      const game = games.get(guildId);
      if (!game) return;

      if (reason === 'started' && game.players.size >= 2) {
        // Game started — give each player a task
        const results = [];
        for (const pid of game.players) {
          const task = TASKS[Math.floor(Math.random() * TASKS.length)];
          results.push(`${task.emoji} <@${pid}>: **${task.task}**`);
        }
        await msg.edit({
          embeds: [embed('🎮 Toulb Started!', [
            ['Players', `${game.players.size} joined!`],
            ['Tasks', results.join('\n')],
            ['', 'Complete your tasks! No money reward — just for fun 🎉'],
          ], 0x9b59b6)],
          components: [],
        }).catch(() => {});
      } else {
        // Timeout or not enough players
        games.delete(guildId);
        await msg.edit({
          embeds: [embed('🎮 Toulb Cancelled', [
            ['', game.players.size < 2 ? 'not enough players (need 2+)' : 'time ran out'],
          ], 0xed4245)],
          components: [],
        }).catch(() => {});
      }
    });
  },
};
