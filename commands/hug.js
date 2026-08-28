const https = require('https');
const { AttachmentBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/X6YT2FsV3bAAAAAC/cat.gif',
  'https://media.tenor.com/SYsRdiK-T7gAAAAC/hug-anime.gif',
];

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = {
  name: 'hug',
  description: 'Hug someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v hug @user`');
    if (target.id === message.author.id) return message.reply('you hug yourself... aww');
    if (target.bot) return message.reply('you try to hug a bot... it dont hug back');

    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    try {
      const buf = await fetchBuffer(gif);
      const attach = new AttachmentBuilder(buf, { name: 'hug.gif' });
      message.channel.send({
        content: `**${message.author.username}** hugs **${target.username}**`,
        files: [attach],
      });
    } catch {
      message.channel.send(`**${message.author.username}** hugs **${target.username}**`);
    }
  },
};
