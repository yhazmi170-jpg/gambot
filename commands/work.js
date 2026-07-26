const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

const jobs = [
  'flipping burgers', 'coding a website', 'driving uber', 'walking dogs',
  'cleaning windows', 'stacking shelves', 'mowing lawns', 'washing cars',
  'delivering pizza', 'pet sitting', 'babysitting', 'tutoring',
];

module.exports = {
  name: 'work',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'work for money (high bal = slightly less)',
  aliases: ['w'],
  execute(message, args) {
    const user = db.ensureUser(message.author.id);
    const cooldown = db.getCooldown(user.work_time, config.workCooldown / 1000);
    if (cooldown > 0) {
      const m = Math.floor(cooldown / 60);
      const s = Math.floor(cooldown % 60);
      return message.channel.send({ embeds: [error(`you're tired. rest for ${m}m ${s}s`)] });
    }
    const base = Math.floor(Math.random() * (config.workMax - config.workMin + 1)) + config.workMin;
    const doubled = db.hasPerk(message.author.id, 'double_work');
    const factor = db.getBalanceFactor(message.author.id);
    const amount = Math.floor((doubled ? base * 2 : base) * factor);
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    db.claimWork(message.author.id, amount);
    message.channel.send({
      embeds: [success(`you worked **${job}** and earned **${amount}** ${config.currency}${doubled ? ' (2x perk!)' : ''}${factor < 1 ? ` (${Math.round((1 - factor) * 100)}% reduction)` : ''}`)],
    });
  },
};
