const db = require('../db');
const { embed, error } = require('../utils/embed');

const ENTRY = {
  the_button: { cmd: 'v button', line: 'press it. or dont. the choice is yours (it resets weekly).' },
  roll_call: { cmd: 'v here', line: 'one roll call per user per hour — marks your attendance.' },
  creature: { cmd: 'v creature', line: 'sightings grant a reward and a wanted-mark, one per user.' },
  quest_rush: { cmd: 'v quest', line: 'daily quest rewards are boosted while this is live.' },
  double_petxp: { cmd: 'v battle', line: 'pets earn double battle XP while this is live.' },
};

module.exports = {
  name: 'event',
  helpCategory: 'Fun',
  description: 'check the currently running community event',
  aliases: ['events'],
  execute(message, args) {
    if (!message.guild) {
      return message.channel.send({ embeds: [error('community events only run in servers')] });
    }
    const ev = db.getActiveCommunityEvent();
    if (!ev) {
      return message.channel.send({ embeds: [embed('📣 Community Event', [['', 'no event is running right now — v event later when one pops, or catch the boots announcement']], 0x2b2d31)] });
    }
    const cfg = db.COMMUNITY_EVENTS[ev.key];
    const entry = ENTRY[ev.key] || { cmd: '', line: '' };
    const secLeft = Math.max(0, ev.endsAt - Math.floor(Date.now() / 1000));
    const mins = Math.floor(secLeft / 60);
    message.channel.send({
      embeds: [embed(`${cfg.emoji} ${cfg.name} — Live`, [
        ['What', cfg.desc],
        ['Time Left', `${mins}m`],
        entry.cmd ? ['How to Join', `\`${entry.cmd}\` — ${entry.line}`] : ['', entry.line],
      ], 0x57f287)],
    });
  },
};