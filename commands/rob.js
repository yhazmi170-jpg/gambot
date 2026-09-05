const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'rob',
  aliases: ['steal'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'rob')) return message.channel.send({ embeds: [error('you need to buy the rob perk from the shop')] });

    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id || target.bot) return message.channel.send({ embeds: [error('mention a real user to rob')] });
    if (target.id === '536278876247162882') return message.channel.send({ embeds: [error("can't rob the owner")] });

    // One rob per day - use persistent cooldown from database
    const now = Date.now();
    const robber = db.ensureUser(message.author.id);
    const lastRob = robber.rob_cooldown || 0;
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
    if (now - lastRob < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastRob)) / (60 * 60 * 1000));
      return message.channel.send({ embeds: [error(`you already robbed today — wait **${remaining}h** to rob again`)] });
    }

    const robber = db.ensureUser(message.author.id);
    const victim = db.ensureUser(target.id);
    if (!victim || victim.balance < 5000000) return message.channel.send({ embeds: [error('they need at least 5,000,000 money to be worth robbing')] });
    if (robber.balance < 5000000) return message.channel.send({ embeds: [error('you need at least 5,000,000 money to attempt a robbery')] });
    if (db.hasOutstandingLoan(message.author.id)) return message.channel.send({ embeds: [error('repay your loan first — `v bank loan pay all`')] });

    const successRoll = Math.random() < 0.3;
    if (successRoll) {
      const stealAmount = Math.min(Math.floor(victim.balance * 0.2), 3000000); // 20% max, capped at 3M
      db.addBalance(message.author.id, stealAmount);
      db.addBalance(target.id, -stealAmount);
      db.run(`UPDATE users SET rob_cooldown = ${now} WHERE user_id = '${message.author.id}'`);
      message.channel.send({ embeds: [success(`you robbed <@${target.id}> and got **${stealAmount.toLocaleString()}** ${config.currency}!`)] });
      target.send(`🔪 **ROBBED!** <@${message.author.id}> robbed you for **${stealAmount.toLocaleString()}** ${config.currency}!\nYour wallet balance is now **${(victim.balance - stealAmount).toLocaleString()}** ${config.currency}.\n⚠️ Keep money in the bank (\`v bank deposit all\`) — bank money can't be robbed!`).catch(() => {});
    } else {
      const loseAmount = Math.min(Math.floor(robber.balance * 0.2), 3000000);
      db.addBalance(message.author.id, -loseAmount);
      
      // Jail time: 30 minutes
      const jailMs = 30 * 60 * 1000;
      const jailUntil = Date.now() + jailMs;
      db.run(`UPDATE users SET jail_until = ${jailUntil} WHERE user_id = '${message.author.id}'`);
      
      // Nerf insurance: reduce insurance level by 1 (min 0)
      const u = db.ensureUser(message.author.id);
      if (u.insurance > 0) {
        db.run(`UPDATE users SET insurance = insurance - 1 WHERE user_id = '${message.author.id}'`);
      }
      
      // Nerf credit score: reduce by 50 points
      if (u.credit_score > 0) {
        db.run(`UPDATE users SET credit_score = credit_score - 50 WHERE user_id = '${message.author.id}'`);
      }
      
      db.run(`UPDATE users SET rob_cooldown = ${now} WHERE user_id = '${message.author.id}'`);
      message.channel.send({ embeds: [error(`🚔 **CAUGHT!** You got caught robbing <@${target.id}> and lost **${loseAmount.toLocaleString()}** ${config.currency}!\n🔒 **JAILED for 30 minutes** — you cannot use commands.\n🛡️ Insurance downgraded by 1 tier.\n📉 Credit score reduced by 50 points.`)] });
      target.send(`🛡️ **ROBBERY FAILED!** <@${message.author.id}> tried to rob you but got caught and lost **${loseAmount.toLocaleString()}** ${config.currency} — your money is safe.`).catch(() => {});
    }
  },
};
