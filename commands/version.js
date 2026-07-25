const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

module.exports = {
  name: 'version',
  aliases: ['ver'],
  description: 'check bot version',
  execute(message, args) {
    const { embed } = require('../utils/embed');
    const uptime = Math.floor(process.uptime());
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    const fields = [
      ['Version', version || '1.0.0'],
      ['Uptime', `${h}h ${m}m ${s}s`],
    ];
    if (message.author.id === '536278876247162882') {
      let msg = '';
      try { msg = fs.readFileSync(path.join(__dirname, '..', 'update_msg.txt'), 'utf8').trim(); } catch {}
      if (msg) fields.push([msg]);
    }
    message.channel.send({ embeds: [embed('Bot Info', fields, 0x2b2d31)] });
  },
};
