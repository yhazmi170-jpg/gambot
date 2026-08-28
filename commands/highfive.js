const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/HozyHCAac-kAAAAC/high-five-patrick-star.gif',
  'https://media.tenor.com/LSnRaq-w0uoAAAAC/portgas-d-ace-ace.gif',
];

module.exports = {
  name: 'highfive',
  description: 'High five someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v highfive @user`');
    if (target.id === message.author.id) return message.reply('you high five yourself... nice');
    if (target.bot) return message.reply('you high five a bot... it doesnt have hands');
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setDescription(`**${message.author.username}** high fives **${target.username}** ✋`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
