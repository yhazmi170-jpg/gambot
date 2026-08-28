const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/hSP6oVG2dTMAAAAC/yonomori-kobeni-anime-girl.gif',
  'https://media.tenor.com/XzFL_M-2AcIAAAAC/bunny-rabbit.gif',
];

module.exports = {
  name: 'boop',
  description: "Boop someone's nose!",
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v boop @user`');
    if (target.id === message.author.id) return message.reply('*boops your own nose*');
    if (target.bot) return message.reply('*boops the bot*... beep');
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setDescription(`**${message.author.username}** boops **${target.username}**'s nose`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
