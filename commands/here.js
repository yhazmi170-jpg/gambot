const db = require('../db');
const { embed, error } = require('../utils/embed');

const userCd = new Map();

module.exports = {
  name: 'here',
  helpCategory: 'Fun',
  description: 'answer a community roll call (event only)',
  aliases: ['rollcall', 'report'],
  execute(message) {
    if (!db.isCommunityEvent('roll_call')) {
      return message.channel.send({ embeds: [error('no roll call is running — the next one will be announced (`v event`)')] });
    }
    if (!message.guild) return message.channel.send({ embeds: [error('roll calls only run in servers')] });
    const uid = message.author.id;
    const now = Date.now();
    if ((userCd.get(uid) || 0) > now - 3600000) {
      return message.channel.send({ embeds: [error('attendance already marked within the last hour')] });
    }
    userCd.set(uid, now);
    db.bumpCounter(uid, 'rollcalls');
    const n = db.ensureUser(uid).rollcalls || 0;
    db.addBalance(uid, 1500);
    try { db.addIncident(message.guild.id, 'event', `<@${uid}> attended roll call (#${n})`); } catch {}
    message.channel.send({
      embeds: [embed('📣 Attendance Noted', [
        ['', `<@${uid}> is present and accounted for. **${1500}** coins logged. your name is on the list. we never miss a list.`],
        ['total', `**${n}** roll calls attended`],
      ], 0x57f287)],
    });
  },
};