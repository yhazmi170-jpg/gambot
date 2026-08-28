const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/X6YT2FsV3bAAAAAC/cat.gif',
  'https://media.tenor.com/SYsRdiK-T7gAAAAC/hug-anime.gif',
];

module.exports = {
  name: 'hug',
  description: 'Hug someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v hug @user`');
    if (target.id === message.author.id) return message.reply('you hug yourself... aww 🤗');
    if (target.bot) return message.reply('you try to hug a bot... it dont hug back 🤖');

    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    message.channel.send(`**${message.author.username}** hugs **${target.username}** 🤗\n${gif}`);
  },
};
