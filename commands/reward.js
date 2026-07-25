const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: 'reward',
  description: 'give a perk to a user (owner only)',
  execute(message, args) {
    if (message.author.id !== config.ownerId) return;

    const target = message.mentions.users.first();
    const perk = args[1];
    if (!target || !perk) return message.channel.send({ embeds: [error('usage: Areward @user <perk_name>')] });

    const validPerks = ['auto_react', 'colored_lb', 'daily_cap', 'bet_cap', 'vip_role_sub', 'sponsored_footer', 'lottery_ticket', 'rain'];
    if (!validPerks.includes(perk)) return message.channel.send({ embeds: [error(`invalid perk. valid: ${validPerks.join(', ')}`)] });

    const duration = args[2] ? parseInt(args[2]) : 0;
    const expiresAt = duration > 0 ? Math.floor(Date.now() / 1000) + duration * 86400 : 0;

    db.addPerk(target.id, perk, expiresAt);
    message.channel.send({ embeds: [success(`gave **${perk}** to <@${target.id}>${duration > 0 ? ` for ${duration} days` : ''}`)] });

    logger.log(message.guild?.id, 'Admin Reward', [
      ['Admin', `${message.author}`],
      ['Target', `${target}`],
      ['Perk', perk],
      ['Duration', duration > 0 ? `${duration} days` : 'permanent'],
    ], 0x57f287);
  },
};
