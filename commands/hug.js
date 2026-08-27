const { EmbedBuilder } = require('discord.js');
const https = require('https');

const TENOR_KEY = 'LIVDSRZULELA';

function fetchGif(query) {
  return new Promise((resolve) => {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=50&media_filter=tinygif`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = json.results || [];
          if (results.length) {
            const pick = results[Math.floor(Math.random() * results.length)];
            resolve(pick.media_formats?.tinygif?.url || pick.url);
          } else resolve(null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
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
    if (target.id === message.author.id) return message.reply('you hug yourself... aww 🤗');
    if (target.bot) return message.reply('you try to hug a bot... it dont hug back 🤖');

    const gif = await fetchGif('anime hug');
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`**${message.author.username}** hugs **${target.username}** 🤗`)
      .setImage(gif || 'https://media.tenor.com/kYBL5Vwqy5sAAAAC/anime-hug.gif')
      .setFooter({ text: `${message.author.username} wants a hug!` });

    message.channel.send({ embeds: [embed] });
  },
};
