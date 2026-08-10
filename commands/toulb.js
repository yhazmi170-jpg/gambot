const db = require('../db');
const { embed, error } = require('../utils/embed');
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

module.exports = {
  name: 'toulb',
  helpCategory: 'Games',
  helpArgs: '',
  aliases: ['tlb', 'solo'],
  description: 'solo toulb game — get a random task to complete (no money, just fun)',
  execute(message, args) {
    const task = TASKS[Math.floor(Math.random() * TASKS.length)];
    const embed_msg = embed(`${task.emoji} Toulb`, [
      ['Task', task.task],
      ['', 'Complete the task above! No money reward — just for fun 🎉'],
    ], 0x9b59b6);
    return message.channel.send({ embeds: [embed_msg] });
  },
};
