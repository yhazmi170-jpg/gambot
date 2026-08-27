const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'highfive',
  description: 'High five someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v highfive @user`');
    if (target.id === message.author.id) return message.reply('you high five yourself... nice! ✋');
    if (target.bot) return message.reply('you high five a bot... it beeps! 🤖✋');

    const responses = [
      `**${message.author.username}** high fives **${target.username}**! ✋`,
      `**${message.author.username}** and **${target.username}** share a high five! 🙌`,
      `*slap!* **${message.author.username}** gives **${target.username}** a high five! ✋`,
      `**${message.author.username}** and **${target.username}** high five — what a team! 🤝`,
    ];

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setDescription(responses[Math.floor(Math.random() * responses.length)])
      .setFooter({ text: 'nice!' });

    message.channel.send({ embeds: [embed] });
  },
};
