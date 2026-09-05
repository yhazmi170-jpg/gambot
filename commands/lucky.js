const db = require('../db');

module.exports = {
  name: 'lucky',
  helpCategory: 'Games',
  helpArgs: '',
  description: 'toggle your personal lucky streak (90% win rate on coinflip / 50% otherwise)',
  execute(message) {
    const enabled = db.toggleLucky(message.author.id);
    const emoji = enabled ? '🍀' : '⚪';
    message.channel.send(`🪙 Your lucky ${enabled ? 'enabled' : 'disabled'} ${emoji} — coinflip now gives **90%** win rate if enabled, **50%** otherwise. Use \`v lucky\` again to toggle back.`);
  },
};