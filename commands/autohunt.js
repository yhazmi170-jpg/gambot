const db = require('../db');
const { embed, success, error } = require('../utils/embed');

module.exports = {
  name: 'autohunt',
  helpCategory: 'Pets',
  helpArgs: '[minutes]',
  aliases: ['ah', 'autohunter'],
  description: 'start auto-hunting — answer a captcha and the bot hunts for you over time',
  async execute(message, args) {
    const userId = message.author.id;

    try { db.catchUpAutohunt(userId); } catch (err) {}

    const existing = db.getAutohunt(userId);
    if (existing) {
      const p = db.getAutohuntProgress(userId);
      return message.channel.send({ embeds: [error(`you already have an autohunt running — **${Math.ceil(p.remaining / 60)}m** left · \`v huntbot\` to check it`)] });
    }

    const user = db.ensureUser(userId);
    const level = user ? user.autohunt_level : 0;
    const maxMin = db.autohuntMaxMinutes(level);
    let minutes = 30;
    if (args[0]) {
      const n = parseInt(args[0], 10);
      if (!isNaN(n) && n > 0) minutes = Math.min(n, maxMin);
    }
    minutes = Math.max(1, minutes);

    const cost = minutes * db.AUTOHUNT_COST_PER_MIN;
    const bal = db.getBalance(userId);
    if (bal < cost) return message.channel.send({ embeds: [error(`an autohunt for **${minutes}m** costs **${cost}** coins (you have **${bal}**)`)] });

    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    const msg = await message.channel.send({
      embeds: [embed('Captcha', [
        ['Prove you are human', `what is **${a} + ${b}**?\nanswer in chat within 45 seconds, or the autohunt is cancelled`],
        ['Cost', `**${cost}** coins for **${minutes}** minutes of auto-hunting`],
        ['Yield', `**${db.autohuntAnimalsPerCycle(level)}** animal(s) per minute${level > 0 ? ` (rank **${db.autohuntRank(level)}**)` : ''}`],
      ], 0x2b2d31)],
    });

    const filter = m => m.author.id === userId && parseInt(m.content, 10) === a + b;
    const col = message.channel.createMessageCollector({ filter, time: 45000, max: 1 });

    col.on('collect', async () => {
      const r = db.startAutohunt(userId, minutes);
      if (!r.ok) {
        msg.edit({ embeds: [error(`not enough coins — autohunt cancelled`)], components: [] }).catch(() => {});
        return;
      }
      msg.edit({
        embeds: [success(`autohunt started — **${minutes}m** of auto-hunting (**${db.autohuntAnimalsPerCycle(db.ensureUser(userId).autohunt_level)}** animal(s)/min)\n\nprogress shows in \`v huntbot\`, and animals are added even while you are offline`)],
        components: [],
      }).catch(() => {});
    });

    col.on('end', async collected => {
      if (!collected.size) msg.edit({ embeds: [error('captcha timed out — autohunt cancelled')], components: [] }).catch(() => {});
    });
  },
};
