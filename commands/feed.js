const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/Fh7CJRyjiM4AAAAC/anime-couple-eat-mahiru-and-amne.gif',
  'https://media.tenor.com/DWuHYVTiuoIAAAAC/kurumi-haraga.gif',
  'https://media.tenor.com/Xp6sYBk7YD8AAAAC/anime-food-anime-foodie.gif',
];

module.exports = {
  name: 'feed',
  description: 'Feed someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v feed @user`');
    if (target.id === message.author.id) return message.reply('you feed yourself... okay');
    if (target.bot) return message.reply('bots dont eat... or do they?');
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`**${message.author.username}** feeds **${target.username}**`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
