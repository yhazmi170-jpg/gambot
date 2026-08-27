const { EmbedBuilder } = require('discord.js');

const gifs = [
  'https://media1.tenor.com/m/5hYRZnYpGKIAAAAC/anime-kill.gif',
  'https://media1.tenor.com/m/sx4IAAAAC/anime-death.gif',
  'https://media1.tenor.com/m/0bTl6PwbkFIAAAAC/anime-stab.gif',
  'https://media1.tenor.com/m/lHEp8YvCjYIAAAAC/anime-sword.gif',
  'https://media1.tenor.com/m/5vP4G4g6yMIAAAAC/anime-kill.gif',
  'https://media1.tenor.com/m/7JfBhYkCjYsAAAAC/anime-slash.gif',
  'https://media1.tenor.com/m/3Hgq6XbKhIAAAAC/anime-death.gif',
  'https://media1.tenor.com/m/gKBfN8hCvYMAAAAC/anime-kill.gif',
  'https://media1.tenor.com/m/71zYx4O6dbsAAAAC/anime-sword.gif',
  'https://media1.tenor.com/m/t_5MsYO3PxMAAAAC/anime-stab.gif',
  'https://media1.tenor.com/m/5Z4Lw6pE-8IAAAAC/anime-kill.gif',
  'https://media1.tenor.com/m/w-MLB6LqgLoAAAAC/anime-death.gif',
  'https://media1.tenor.com/m/1zMiixyeUdsAAAAC/anime-slash.gif',
  'https://media1.tenor.com/m/3wAvE5HTRXoAAAAC/anime-kill.gif',
  'https://media1.tenor.com/m/VXFPnMKHRXcAAAAC/anime-sword.gif',
  'https://media1.tenor.com/m/5hYRZnYpGKIAAAAC/anime-slash.gif',
  'https://media1.tenor.com/m/0bTl6PwbkFIAAAAC/anime-kill.gif',
  'https://media1.tenor.com/m/lHEp8YvCjYIAAAAC/anime-death.gif',
  'https://media1.tenor.com/m/sx4IAAAAC/anime-stab.gif',
  'https://media1.tenor.com/m/5vP4G4g6yMIAAAAC/anime-sword.gif',
];

module.exports = {
  name: 'kill',
  description: 'Kill someone!',
  helpCategory: 'fun',
  helpArgs: '<@user>',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('`v kill @user`');
    if (target.id === message.author.id) return message.reply('you try to kill yourself... please dont 😰');
    if (target.bot) return message.reply('you cant kill a bot... theyre already dead inside 🤖💀');

    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`**${message.author.username}** kills **${target.username}** 💀`)
      .setImage(gif)
      .setFooter({ text: 'rest in peace' });

    message.channel.send({ embeds: [embed] });
  },
};
