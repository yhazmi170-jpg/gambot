const db = require('../db');
const { embed, error } = require('../utils/embed');

const ENTRY = {
  the_button: { cmd: 'v button', line: 'press it. or dont. the choice is yours (it resets weekly).' },
  roll_call: { cmd: 'v here', line: 'one roll call per user per hour — marks your attendance.' },
  creature: { cmd: 'v creature', line: 'sightings grant a reward and a wanted-mark, one per user.' },
  quest_rush: { cmd: 'v quest', line: 'daily quest rewards are boosted while this is live.' },
  double_petxp: { cmd: 'v battle', line: 'pets earn double battle XP while this is live.' },
  great_hunt: { cmd: 'v hunt', line: 'every animal you catch counts toward a shared server goal.' },
  gem_rush: { cmd: 'v hunt', line: 'gem drops are doubled while this is live.' },
  pet_festival: { cmd: 'v animal', line: 'your pets bond twice as fast while this is live.' },
  dex_challenge: { cmd: 'v hunt', line: 'discovering a new species pays bonus coins + gems.' },
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
    const fields = [
      ['What', cfg.desc],
      ['Time Left', `${mins}m`],
    ];
    if (cfg.coop) {
      const p = db.getCommunityProgress(message.guild.id, ev.key, message.guild.memberCount);
      const pct = p.goal > 0 ? Math.min(100, Math.floor((p.progress / p.goal) * 100)) : 0;
      const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
      fields.push(['Server Goal', `${bar} **${p.progress}/${p.goal}**`]);
      fields.push(['Contributors', `${p.contributors} hunter${p.contributors === 1 ? '' : 's'}${p.rewarded ? ' — goal hit, rewards sent to inbox!' : ''}`]);
    }
    fields.push(entry.cmd ? ['How to Join', `\`${entry.cmd}\` — ${entry.line}`] : ['', entry.line]);
    message.channel.send({
      embeds: [embed(`${cfg.emoji} ${cfg.name} — Live`, fields, 0x57f287)],
    });
  },
};