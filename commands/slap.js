const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'slap',
  description: 'Slap someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v slap @user`');
    if (target.id === message.author.id) return message.reply('you slap yourself... why? 😭');
    if (target.bot) return message.reply('you try to slap a bot... your hand hurts 🤖✋');

    const responses = [
      `**${message.author.username}** slaps **${target.username}** across the face! 👋`,
      `**${message.author.username}** gives **${target.username}** a big slap! 👋`,
      `**${message.author.username}** smacks **${target.username}**! 💥`,
      `**${message.author.username}** slaps **${target.username}** so hard they see stars! ⭐`,
      `**${message.author.username}**无情地扇了 **${target.username}** 一巴掌! 👋`,
    ];

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(responses[Math.floor(Math.random() * responses.length)])
      .setFooter({ text: 'ouch!' });

    message.channel.send({ embeds: [embed] });
  },
};
