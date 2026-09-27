const db = require('../db');
const { embed, error, success } = require('../utils/embed');

const CATS = [
  { key: 'tips', label: '💡 Smart tips', desc: 'occasional useful state-aware tips (banking, inbox, crates, team...) — max ~1 every few days' },
  { key: 'inactivity', label: '📡 Inactivity DMs', desc: 'a "been a minute" DM after you go quiet for a week+, then again at 14/30/60d' },
  { key: 'rewards', label: '🎁 Comeback + surprise rewards', desc: 'inbox gifts if you come back after a long break, or very rarely while you play' },
];

module.exports = {
  name: 'notifications',
  helpCategory: 'Info',
  helpArgs: '[on|off|tips|inactivity|rewards] [on|off]',
  description: 'control Gambot\u0027s proactive DMs (tips, inactivity pings, reward notices)',
  aliases: ['notif', 'notifs', 'dmprefs'],
  execute(message, args) {
    const uid = message.author.id;
    const p = db.getNotifyPrefs(uid);
    const cur = { tips: !!p.tips, inactivity: !!p.inactivity, rewards: !!p.rewards };
    const a = (args[0] || '').toLowerCase();
    const a2 = (args[1] || '').toLowerCase();

    const setAll = (v) => {
      db.setNotifyPrefs(uid, { tips: v, inactivity: v, rewards: v });
      return message.channel.send({ embeds: [success(`${v ? 'on' : 'off'} — Gambot ${v ? 'may' : 'won\u0027t'} DM you proactive tips, inactivity pings or reward notices anymore.`)] });
    };
    if (a === 'on' || a === 'off') {
      if (a2) return message.channel.send({ embeds: [error('use `v notifications on|off` (all) or `v notifications <category> on|off`')] });
      return setAll(a === 'on');
    }
    if (a === 'tips' || a === 'inactivity' || a === 'rewards') {
      if (a2 !== 'on' && a2 !== 'off') return message.channel.send({ embeds: [error(`usage: \`v notifications ${a} on\` / \`off\``)] });
      db.setNotifyPrefs(uid, { [a]: a2 === 'on' });
      return message.channel.send({ embeds: [success(`\`${a}\` is now **${a2 === 'on' ? 'on' : 'off'}**`)] });
    }
    if (a === 'reset') {
      db.setNotifyPrefs(uid, { tips: true, inactivity: true, rewards: true });
      return message.channel.send({ embeds: [success('all proactive-DM categories back to default (on)')] });
    }
    if (a) return message.channel.send({ embeds: [error('unknown option — `v notifications on|off|tips|inactivity|rewards|reset`')] });

    const rows = CATS.map(c => [`${cur[c.key] ? '✅ on' : '🚫 off'} — ${c.label}`, c.desc]);
    rows.push(['', 'summons (the old `v summon`) stay separate — `v summon off` still blocks those DMs']);
    rows.push(['', 'anything here fails silently if your DMs are closed — it never blocks a command. defaults are on but rare.']);
    return message.channel.send({ embeds: [embed('🔔 Notifications', rows, 0x2b2d31)] });
  },
};