const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: 'removereward',
  aliases: ['rmreward'],
  description: 'remove a perk from a user (owner only)',
  execute(message, args) {
    if (message.author.id !== config.ownerId) return;

    const target = message.mentions.users.first();
    const perk = args[1];
    if (!target || !perk) return message.channel.send({ embeds: [error('usage: Aremovereward @user <perk_name>')] });

    if (!db.hasPerk(target.id, perk)) return message.channel.send({ embeds: [error("that user doesn't have that perk")] });

    db.removePerk(target.id, perk);
    message.channel.send({ embeds: [success(`removed **${perk}** from <@${target.id}>`)] });

    logger.logCmd(message.guild?.id, 'Admin Remove Reward', [
      ['Admin', `${message.author}`],
      ['Target', `${target}`],
      ['Perk', perk],
    ], 0xed4245);
  },
};
