const { version } = require('../package.json');

const hints = [
  'did you know v hunt gives you free animals?',
  'try v battle @someone for fun pvp',
  'v work = free money every 10 min',
  'v daily resets every 24h — don\'t miss it',
  'v rob @someone if you\'re feeling risky',
  'owo is watching... always watching',
  'v slots all is the fastest way to 0 or hero',
  'marry someone for shared wealth with v marry',
  'v zoo shows all your collected animals',
  'type v help to see all commands',
];

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
      fields.push(['Tip', hints[Math.floor(Math.random() * hints.length)]]);
    }
    message.channel.send({ embeds: [embed('Bot Info', fields, 0x2b2d31)] });
  },
};
