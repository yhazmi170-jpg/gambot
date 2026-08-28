const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/TG5GWBDw8LsAAAAC/hamster-vegtables.gif',
  'https://media.tenor.com/HZLeLAMA9TgAAAAC/anime-hurt.gif',
  'https://media.tenor.com/e4Ezqa83pRYAAAAC/knife-kill.gif',
];

module.exports = {
  name: 'kill',
  description: 'Kill someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v kill @user`');
    if (target.id === message.author.id) return message.reply('you try to kill yourself... please dont');
    if (target.bot) return message.reply('you cant kill a bot... theyre already dead inside');
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`**${message.author.username}** kills **${target.username}**`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
