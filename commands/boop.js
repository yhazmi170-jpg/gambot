const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'boop',
  description: 'Boop someone\'s nose!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v boop @user`');
    if (target.id === message.author.id) return message.reply('you boop your own nose! *boop* 🔵');
    if (target.bot) return message.reply('you boop a bot\'s nose... it makes a beep sound 🔵🤖');

    const responses = [
      `**${message.author.username}** boops **${target.username}**'s nose! 🔵`,
      `**${message.author.username}** gives **${target.username}** a gentle boop! 👃`,
      `*boop!* **${message.author.username}** pokes **${target.username}**'s nose! 🔵`,
      `**${message.author.username}** reaches out and boops **${target.username}**! 👆`,
    ];

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setDescription(responses[Math.floor(Math.random() * responses.length)])
      .setFooter({ text: 'boop!' });

    message.channel.send({ embeds: [embed] });
  },
};
