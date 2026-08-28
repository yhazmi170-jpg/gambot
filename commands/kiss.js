const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/cHJGRakNA7kAAAAC/anime-love.gif',
  'https://media.tenor.com/GoPV-W2pxMUAAAAC/kiss.gif',
  'https://media.tenor.com/ImYsZmwu8jYAAAAC/anime-forehead-kiss-anime.gif',
  'https://media.tenor.com/ZJkYFIlY_ToAAAAC/kissing-sophie-milan-wife.gif',
  'https://media.tenor.com/kmxEaVuW8AoAAAAC/kiss-gentle-kiss.gif',
];

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
    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setDescription(`**${message.author.username}** kisses **${target.username}**`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
