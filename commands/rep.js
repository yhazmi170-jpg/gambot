const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config.json');

module.exports = {
  name: 'rep',
  aliases: ['reputation'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'rep')) {
      return message.channel.send({ embeds: [error('you don\'t own the rep perk. buy it from the shop.')] });
    }
    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id || target.bot) {
      return message.channel.send({ embeds: [error('mention a valid user to give rep to')] });
    }
    const user = db.ensureUser(message.author.id);
    const cooldown = db.getCooldown(user.rep_time, 3600);
    if (cooldown > 0) {
      const m = Math.floor(cooldown / 60);
      const s = Math.floor(cooldown % 60);
      return message.channel.send({ embeds: [error(`you can give rep again in ${m}m ${s}s`)] });
    }
    db.addRep(message.author.id, target.id, 1);
    message.channel.send({
      embeds: [success(`you gave 1 rep to <@${target.id}> (they now have ${db.getRep(target.id)} rep)`)],
    });
  },
};
