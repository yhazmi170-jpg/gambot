const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/zVBcLjKZNmsAAAAC/anime-hug.gif',
  'https://media.tenor.com/4A9BTa_QLVUAAAAC/hug.gif',
  'https://media.tenor.com/ZzyVbk_S5ZAAAAAC/gyaru-gyaru-pixel.gif',
  'https://media.tenor.com/hEdjcUvyj5EAAAAC/anime-girl-blush-weepymiyu-vtuber.gif',
];

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
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`**${message.author.username}** hugs **${target.username}**`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
