const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'feed',
  description: 'Feed someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v feed @user`');
    if (target.id === message.author.id) return message.reply('you feed yourself... nom nom 🍕');
    if (target.bot) return message.reply('you try to feed a bot... it doesn\'t eat 🤖🍽️');

    const foods = ['🍕 pizza', '🍔 burger', '🍣 sushi', '🍜 ramen', '🍩 donut', '🍦 ice cream', '🍰 cake', '🌮 taco', '🍿 popcorn', '🧋 boba tea'];
    const food = foods[Math.floor(Math.random() * foods.length)];

    const responses = [
      `**${message.author.username}** feeds **${target.username}** some ${food}! 🍽️`,
      `**${message.author.username}** gives **${target.username}** ${food}! 😋`,
      `**${target.username}** receives ${food} from **${message.author.username}**! 🤤`,
    ];

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(responses[Math.floor(Math.random() * responses.length)])
      .setFooter({ text: 'yum!' });

    message.channel.send({ embeds: [embed] });
  },
};
