const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'vault',
  helpCategory: 'Economy',
  helpArgs: '<deposit|withdraw> <amount>',
  description: 'shared server vault — deposit coins, withdraw what you put in',
  aliases: ['clanvault'],
  execute(message, args) {
    const guildId = message.guild ? message.guild.id : null;
    if (!guildId) return message.channel.send({ embeds: [error('this only works in a server')] });
    const userId = message.author.id;
    const cmd = (args[0] || '').toLowerCase();
    const amount = parseAmount(args[1]);

    if (cmd === 'deposit') {
      if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('usage: `v vault deposit <amount>`')] });
      const ok = db.vaultDeposit(guildId, userId, amount);
      if (!ok) return message.channel.send({ embeds: [error('you don\'t have enough coins to deposit that')] });
      const v = db.getVault(guildId);
      return message.channel.send({ embeds: [success(`deposited **${amount.toLocaleString()}** ${config.currency} into the vault — balance is now **${v.balance.toLocaleString()}**`) ] });
    }

    if (cmd === 'withdraw') {
      if (isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('usage: `v vault withdraw <amount>`')] });
      const got = db.vaultWithdraw(guildId, userId, amount);
      if (got <= 0) return message.channel.send({ embeds: [error('you can only withdraw coins you deposited (and the vault must have them)')] });
      return message.channel.send({ embeds: [success(`withdrew **${got.toLocaleString()}** ${config.currency} from the vault`) ] });
    }

    const v = db.getVault(guildId);
    const top = db.getVaultTop(guildId, 5);
    const topLines = top.length ? top.map((t, i) => `${['🥇', '🥈', '🥉'][i] || '▫️'} <@${t.user_id}> — **${t.deposited.toLocaleString()}** ${config.currency}`).join('\n') : 'nobody has deposited yet';
    return message.channel.send({ embeds: [embed('🏦 Clan Vault', [
      ['Balance', `**${v.balance.toLocaleString()}** ${config.currency}`],
      ['Top depositors', topLines],
      ['', '`v vault deposit <amount>` · `v vault withdraw <amount>`'],
    ], 0xfee75c)] });
  },
};
