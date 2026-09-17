const db = require('../db');
const { embed, error } = require('../utils/embed');

module.exports = {
  name: 'summon',
  helpCategory: 'Fun',
  helpArgs: '[off|on]',
  description: "control whether Gambot DM-summons you after long absences",
  aliases: ['summons'],
  execute(message, args) {
    const uid = message.author.id;
    const mode = (args[0] || '').toLowerCase();
    const current = !!db.getSummonOptOut(uid);
    if (mode === 'off') {
      db.setSummonOptOut(uid, true);
      return message.channel.send({ embeds: [embed('📵 Summons Off', [['', "ok bro, Gambot won't DM you after long absences anymore. you can flip back anytime with `v summon on`."]], 0x2b2d31)] });
    }
    if (mode === 'on') {
      db.setSummonOptOut(uid, false);
      return message.channel.send({ embeds: [embed('📡 Summons On', [['', "you're back on the radar — a rare DM may arrive only if you vanish for a while."]], 0x57f287)] });
    }
    const state = current ? 'off (no DMs)' : 'on (rare DM possible after a long break)';
    return message.channel.send({ embeds: [embed('📡 Gambot Summons', [['', `currently **${state}**.\n\`v summon off\` → never DM me again\n\`v summon on\` → re-enable\n\nsummons are rare, based on general inactivity, and never tied to gambling — no lectures, just a gentle nudge to \`v try\` when you fancy coming back.`]], 0x2b2d31)] });
  },
};