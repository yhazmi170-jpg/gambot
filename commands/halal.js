module.exports = {
  name: 'halal',
  description: 'make bot halal certified 🇸🇦',
  execute(message, args) {
    const { embed } = require('../utils/embed');
    message.channel.send({
      embeds: [embed('🇸🇦 Halal Mode Activated', [
        ['', 'this bot is now 100% halal certified'],
        ['', 'no riba · no gharar · may allah bless your virtual coins'],
        ['', '🤲🐑'],
      ], 0x2ecc71)],
    });
  },
};
