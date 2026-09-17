const db = require('../db');
const { embed, error } = require('../utils/embed');

const httpUrl = (s) => /^https?:\/\/[^\s]+$/.test(s || '') ? s : null;

module.exports = {
  name: 'avatar',
  helpCategory: 'Profile',
  helpArgs: '[url|clear]',
  description: 'set a custom avatar shown on ur profile — v avatar <url>, v avatar clear to remove',
  aliases: ['av', 'ava', 'sav'],
  execute(message, args) {
    const arg = (args[0] || '').toLowerCase();
    if (arg === 'clear') {
      db.clearAvatarUrl(message.author.id);
      return message.channel.send({ embeds: [embed('🖼️ Avatar cleared', [['', 'ur profile uses the default avatar again']], 0x2b2d31)] });
    }
    const url = httpUrl(args[0]);
    if (!url) {
      const cur = db.ensureUser(message.author.id)?.avatar_url;
      if (cur) return message.channel.send({ embeds: [embed('🖼️ Avatar', [['Current', cur]], 0x2b2d31)] });
      return message.channel.send({ embeds: [error('give an image url (https://...) or `clear` to remove it')] });
    }
    const set = db.setAvatarUrl(message.author.id, url);
    if (!set) return message.channel.send({ embeds: [error('that url doesnt look valid')] });
    return message.channel.send({ embeds: [embed('🖼️ Avatar set', [['', 'it now shows on ur profile']], 0x2b2d31)] });
  },
};