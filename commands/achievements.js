const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'achievements',
  helpCategory: 'Pets',
  helpArgs: '',
  description: 'view your unlocked achievements',
  aliases: ['ach', 'trophies'],
  execute(message, args) {
    const userId = message.author.id;
    const unlocked = new Set(db.getAchievements(userId));
    const list = db.getAchievementList();
    const done = list.filter(a => unlocked.has(a.key));
    const todo = list.filter(a => !unlocked.has(a.key));

    const doneLines = done.length ? done.map(a => `${a.name} — ${a.desc}`) : ['none yet — go play!'];
    const todoLines = todo.length ? todo.slice(0, 12).map(a => `🔒 ${a.name} — ${a.desc}`) : [];

    const pct = Math.floor((done.length / list.length) * 100);
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));

    const fields = [
      ['Progress', `${bar} **${pct}%** (${done.length}/${list.length})`],
      ['Unlocked', doneLines.join('\n')],
    ];
    if (todoLines.length) fields.push(['Locked', todoLines.join('\n')]);
    fields.push(['', 'achievements auto-unlock as you play and pay coins!']);

    return message.channel.send({ embeds: [embed('🏅 Achievements', fields, 0xf1c40f)] });
  },
};
