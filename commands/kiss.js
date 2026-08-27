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
  name: 'kiss',
  description: 'Kiss someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v kiss @user`');
    if (target.id === message.author.id) return message.reply('you kiss yourself... weirdo 😘');
    if (target.bot) return message.reply('you cant kiss a bot... or can you? 👀');

    const gif = await fetchGif('anime kiss');
    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setDescription(`**${message.author.username}** kisses **${target.username}** 💋`)
      .setImage(gif || 'https://media.tenor.com/mEJQN5aosu4gAAAAC/anime-kiss-anime.gif')
      .setFooter({ text: `${message.author.username} wants a kiss back!` });

    message.channel.send({ embeds: [embed] });
  },
};
