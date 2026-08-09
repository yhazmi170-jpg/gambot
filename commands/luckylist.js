const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'luckylist',
  helpCategory: 'Admin',
  aliases: ['whoselucky', 'luckies'],
  description: 'list all users with lucky enabled',
  execute(message, args) {
    const rows = db.exec('SELECT user_id, lucky FROM users WHERE lucky = 1');
    if (!rows.length || !rows[0].values.length) {
      return message.channel.send({ embeds: [embed('🍀 Lucky Users', [['', 'no one has lucky enabled right now']])] });
    }
    const lines = rows[0].values.map(r => `<@${r[0]}> — lucky 🍀`).join('\n');
    return message.channel.send({ embeds: [embed(`🍀 Lucky Users (${rows[0].values.length})`, [['', lines]])] });
  },
};
