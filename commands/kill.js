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
  name: 'kill',
  description: 'Kill someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v kill @user`');
    if (target.id === message.author.id) return message.reply('you try to kill yourself... please dont 😰');
    if (target.bot) return message.reply('you cant kill a bot... theyre already dead inside 🤖💀');

    const gif = await fetchGif('anime kill stab');
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`**${message.author.username}** kills **${target.username}** 💀`)
      .setImage(gif || 'https://media.tenor.com/kYBL5Vwqy5sAAAAC/anime-kill.gif')
      .setFooter({ text: 'rest in peace' });

    message.channel.send({ embeds: [embed] });
  },
};
