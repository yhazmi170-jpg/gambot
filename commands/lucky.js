const db = require('../db');

// Owner ID for Gambot
const OWNER_ID = '536278876247162882';

module.exports = {
  name: 'Alucky',
  helpCategory: 'Admin',
  helpArgs: '',
  description: 'owner-only: toggle personal lucky streak',
  aliases: ['Alucky'],
  execute(message) {
    const authorId = message.author.id;
    
    // Only owner can toggle lucky
    if (authorId !== OWNER_ID) {
      return message.channel.send({
        embeds: [{ title: '🚫 Owner Only', description: 'This command is reserved for the bot owner.' }]
      });
    }
    
    const on = db.toggleLucky(authorId);
    message.channel.send({
      embeds: [{ title: '🍀 Lucky Streak', description: `<@${authorId}> is now ${on ? 'lucky' : 'unlucky'} 🌟` }]
    });
  },
};
