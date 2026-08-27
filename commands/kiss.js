const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media1.tenor.com/m/EJQN5aosu4gAAAAC/anime-kiss-anime.gif',
  'https://media1.tenor.com/m/p4pT26zIlmkAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/kysTmemwn74AAAAC/anime-kiss-anime.gif',
  'https://media1.tenor.com/m/sn-5HBmgdPgAAAAC/kiss-anime-anime.gif',
  'https://media1.tenor.com/m/5ZRhdO3b3BcAAAAC/kiss-anime.gif',
  'https://media1.tenor.com/m/x2bMf5bYm2gAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/t4ZJLQF5MjAAAAAC/anime-kiss-anime.gif',
  'https://media1.tenor.com/m/yGqkMDqj9MIAAAAC/kiss.gif',
  'https://media1.tenor.com/m/mXZzJq3gV-oAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/7dJWLXiXo3oAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/WBfSQxhsbMEAAAAC/kiss-anime.gif',
  'https://media1.tenor.com/m/gEwbR1gY0cQAAAAC/kiss-anime.gif',
  'https://media1.tenor.com/m/yGkqH6V0H5sAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/JiF3c6sA2-sAAAAC/anime-kiss-anime.gif',
  'https://media1.tenor.com/m/3aH3xqfUBq4AAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/l5Fb0e3hK5kAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/0A5JXznq0nIAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/jR8z2hYJLkYAAAAC/kiss-anime.gif',
  'https://media1.tenor.com/m/k8Xf9f5g5CwAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/7dJWLXiXo3oAAAAC/anime-kiss-anime.gif',
  'https://media1.tenor.com/m/0A5JXznq0nIAAAAC/anime-kiss-anime.gif',
  'https://media1.tenor.com/m/t4ZJLQF5MjAAAAAC/kiss-anime.gif',
  'https://media1.tenor.com/m/5ZRhdO3b3BcAAAAC/anime-kiss-anime.gif',
  'https://media1.tenor.com/m/yGqkMDqj9MIAAAAC/anime-kiss.gif',
  'https://media1.tenor.com/m/x2bMf5bYm2gAAAAC/kiss.gif',
];

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

    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setDescription(`**${message.author.username}** kisses **${target.username}** 💋`)
      .setImage(gif)
      .setFooter({ text: `${message.author.username} wants a kiss back!` });

    message.channel.send({ embeds: [embed] });
  },
};
