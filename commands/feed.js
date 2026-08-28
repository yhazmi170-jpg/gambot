const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/b_6n6XgPTpkAAAAC/anime-icecream.gif',
  'https://media.tenor.com/WFXYVA9FpZkAAAAC/couple-relationship.gif',
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
