const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

module.exports = {
  name: 'version',
  aliases: ['ver'],
  description: 'check bot version and latest update',
  execute(message, args) {
    const { embed } = require('../utils/embed');
    const uptime = Math.floor(process.uptime());
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    let updateMsg = '';
    try { updateMsg = fs.readFileSync(path.join(__dirname, '..', 'update_msg.txt'), 'utf8').trim(); } catch {}
    message.channel.send({
      embeds: [embed('Bot Info', [
        ['Version', version || '1.0.0'],
        ['Uptime', `${h}h ${m}m ${s}s`],
        ...(updateMsg ? [['Latest Update', updateMsg]] : []),
      ], 0x2b2d31)],
    });
  },
};
