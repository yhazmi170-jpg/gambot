const { version } = require('../package.json');

module.exports = {
  name: 'version',
  aliases: ['ver'],
  description: 'check bot version and uptime',
  execute(message, args) {
    const { embed } = require('../utils/embed');
    const uptime = Math.floor(process.uptime());
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    message.channel.send({
      embeds: [embed('Bot Info', [
        ['Version', version || '1.0.0'],
        ['Uptime', `${h}h ${m}m ${s}s`],
        ['Host', 'Replit 24/7'],
      ], 0x2b2d31)],
    });
  },
};
