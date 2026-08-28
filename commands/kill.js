const https = require('https');
const { AttachmentBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/NbBCakbfZnkAAAAC/die-kill.gif',
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
  name: 'kill',
  description: 'Kill someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v kill @user`');
    if (target.id === message.author.id) return message.reply('you try to kill yourself... please dont');
    if (target.bot) return message.reply('you cant kill a bot... theyre already dead inside');

    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    try {
      const buf = await fetchBuffer(gif);
      const attach = new AttachmentBuilder(buf, { name: 'kill.gif' });
      message.channel.send({
        content: `**${message.author.username}** kills **${target.username}**`,
        files: [attach],
      });
    } catch {
      message.channel.send(`**${message.author.username}** kills **${target.username}**`);
    }
  },
};
