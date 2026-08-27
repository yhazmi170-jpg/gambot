const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'pat',
  description: 'Pat someone on the head!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v pat @user`');
    if (target.id === message.author.id) return message.reply('you pat yourself on the head... good job! 🥰');
    if (target.bot) return message.reply('you pat a bot... it beeps happily 🤖💕');

    const responses = [
      `**${message.author.username}** pats **${target.username}** on the head! 🥰`,
      `**${message.author.username}** gives **${target.username}** gentle head pats! 💕`,
      `**${message.author.username}** pats **${target.username}** — they look happy! 😊`,
      `**${message.author.username}** gives **${target.username}** soothing head pats! 🐾`,
    ];

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setDescription(responses[Math.floor(Math.random() * responses.length)])
      .setFooter({ text: 'so wholesome!' });

    message.channel.send({ embeds: [embed] });
  },
};
