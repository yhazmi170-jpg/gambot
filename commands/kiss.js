const https = require('https');
const { AttachmentBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/EJQN5aosu4gAAAAC/anime-kiss-anime.gif',
  'https://media.tenor.com/kysTmemwn74AAAAC/anime-kiss-anime.gif',
  'https://media.tenor.com/p4pT26zIlmkAAAAC/anime-kiss.gif',
  'https://media.tenor.com/sn-5HBmgdPgAAAAC/kiss-anime-anime.gif',
  'https://media.tenor.com/RxOLELh65TEAAAAC/kiss-anime-the-villainess-is-adored-by-the-prince-of-the-neighbor-kingdom.gif',
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
  name: 'kiss',
  description: 'Kiss someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v kiss @user`');
    if (target.id === message.author.id) return message.reply('you kiss yourself... weirdo');
    if (target.bot) return message.reply('you cant kiss a bot... or can you?');

    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    try {
      const buf = await fetchBuffer(gif);
      const attach = new AttachmentBuilder(buf, { name: 'kiss.gif' });
      message.channel.send({
        content: `**${message.author.username}** kisses **${target.username}**`,
        files: [attach],
      });
    } catch {
      message.channel.send(`**${message.author.username}** kisses **${target.username}** 💋`);
    }
  },
};
