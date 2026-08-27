const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media1.tenor.com/m/WFqBN53E0cMAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/rvQCQz3xXKsAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/H8yzE11jyqoAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/30dK1D2fjXIAAAAC/cute-anime-hug.gif',
  'https://media1.tenor.com/m/O6dJFx1yx1IAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/YXf-2QfKpOAAAAA/anime-hug.gif',
  'https://media1.tenor.com/m/JKyx0aFwQ-sAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/mEaFhPwCKsIAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/8ZqJcZwz0eAAAAA/anime-hug.gif',
  'https://media1.tenor.com/m/2CMYV1yZfjIAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/pMoLJXn1hXcAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/2CEvJRJN5iIAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/ZUX1fG8rIcIAAAAC/cute-hug.gif',
  'https://media1.tenor.com/m/r4VJExQg5lUAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/tYjMDNgBrxIAAAAC/hug-anime.gif',
  'https://media1.tenor.com/m/5Z4Lw6pE-8IAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/w-MLB6LqgLoAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/1zMiixyeUdsAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/3wAvE5HTRXoAAAAC/anime-hug.gif',
  'https://media1.tenor.com/m/VXFPnMKHRXcAAAAC/anime-hug.gif',
];

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

    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`**${message.author.username}** hugs **${target.username}** 🤗`)
      .setImage(gif)
      .setFooter({ text: `${message.author.username} wants a hug!` });

    message.channel.send({ embeds: [embed] });
  },
};
