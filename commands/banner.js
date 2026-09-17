const db = require('../db');
const { embed, error } = require('../utils/embed');

const httpUrl = (s) => /^https?:\/\/[^\s]+$/.test(s || '') ? s : null;

module.exports = {
  name: 'banner',
  helpCategory: 'Profile',
  helpArgs: '[url|clear]',
  description: 'set a banner image shown on ur profile — v banner <url>, v banner clear to remove',
  aliases: ['bn', 'bnr'],
  execute(message, args) {
    const arg = (args[0] || '').toLowerCase();
    if (arg === 'clear') {
      db.clearBannerUrl(message.author.id);
      return message.channel.send({ embeds: [embed('🖼️ Banner cleared', [['', 'ur profile shows no banner anymore']], 0x2b2d31)] });
    }
    const url = httpUrl(args[0]);
    if (!url) {
      const cur = db.ensureUser(message.author.id)?.banner_url;
      if (cur) return message.channel.send({ embeds: [embed('🖼️ Banner', [['Current', cur]], 0x2b2d31)] });
      return message.channel.send({ embeds: [error('give an image url (https://...) or `clear` to remove it')] });
    }
    const set = db.setBannerUrl(message.author.id, url);
    if (!set) return message.channel.send({ embeds: [error('that url doesnt look valid')] });
    return message.channel.send({ embeds: [embed('🖼️ Banner set', [['', 'it now shows on ur profile']], 0x2b2d31)] });
  },
};