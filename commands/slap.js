const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/Up9LqtY-AuIAAAAC/anime-chika-fujiwara.gif',
  'https://media.tenor.com/nT0YsrLM92kAAAAC/mita-miside.gif',
  'https://media.tenor.com/5yBfcWa5oeEAAAAC/sinon-backroom.gif',
];

module.exports = {
  name: 'slap',
  description: 'Slap someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v slap @user`');
    if (target.id === message.author.id) return message.reply('you slap yourself... why?');
    if (target.bot) return message.reply('you slap a bot... your hand hurts');
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setDescription(`**${message.author.username}** slaps **${target.username}**`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
