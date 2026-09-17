const db = require('../db');
const { embed, error } = require('../utils/embed');

const userCd = new Map();

module.exports = {
  name: 'button',
  helpCategory: 'Fun',
  description: 'press The Button (community event only)',
  aliases: ['press'],
  execute(message) {
    if (!db.isCommunityEvent('the_button')) {
      return message.channel.send({ embeds: [error('no button to press right now — wait for the next event (`v event`)')] });
    }
    const uid = message.author.id;
    const now = Date.now();
    if ((userCd.get(uid) || 0) > now - 60000) {
      return message.channel.send({ embeds: [error('you already pressed it — one press per minute')] });
    }
    userCd.set(uid, now);
    db.bumpCounter(uid, 'button_pressed');
    const times = db.ensureUser(uid).button_pressed || 0;
    const reward = 2500 * (times % 5 === 0 && times > 0 ? 2 : 1);
    db.addBalance(uid, reward);
    if (message.guild) {
      try { db.addIncident(message.guild.id, 'event', `<@${uid}> pressed The Button (press #${times})`); } catch {}
    }
    message.channel.send({
      embeds: [embed('🔘 *dramatic pause*', [
        ['', times === 1 ? 'the button has been pressed. records were updated. nobody will explain what it does. you got your reward.' : `press **#${times}** for <@${uid}>. you got **${reward.toLocaleString()}** coins. the button is slightly annoyed.`],
        ['count', `**${times}** total presses (awards ramp at every 5th press)`],
      ], 0xf1c40f)],
    });
  },
};