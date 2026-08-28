const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/kIh2QZ7MhBMAAAAC/tsumiki-anime.gif',
  'https://media.tenor.com/O4fOl9MbuIkAAAAC/pat-good.gif',
  'https://media.tenor.com/uDUcMSv_rQ8AAAAC/headpat-pat.gif',
];

module.exports = {
  name: 'pat',
  description: 'Pat someone on the head!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v pat @user`');
    if (target.id === message.author.id) return message.reply('you pat yourself... nice');
    if (target.bot) return message.reply('you pat the bot... it beeps happily');
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setDescription(`**${message.author.username}** pats **${target.username}**`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
