const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media.tenor.com/NbBCakbfZnkAAAAC/die-kill.gif',
  'https://media.tenor.com/4p2gwNLsxBEAAAAC/whizzy-imposterfox.gif',
  'https://media.tenor.com/N-hqFXWnMbgAAAAC/aot-attack-on-titan.gif',
  'https://media.tenor.com/Q5p5qcPPPYoAAAAC/zenin-jjk.gif',
  'https://media.tenor.com/vn1F8eoL9lEAAAAC/killua-anime.gif',
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
      .setDescription(`**${message.author.username}** kills **${target.username}** 💀`)
      .setImage(gif);
    message.channel.send({ embeds: [embed] });
  },
};
