const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

const QUEST_LABELS = {
  hunt: 'hunt animals',
  sacrifice: 'sacrifice animals',
  win: 'win coins from games',
  work: 'work shifts',
  give: 'give coins to other players',
  battle: 'win battles',
};

module.exports = {
  name: 'quest',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'view your daily quest — complete it for coins',
  aliases: ['q'],
  execute(message, args) {
    const userId = message.author.id;
    const cmd = (args[0] || '').toLowerCase();

    if (cmd === 'claim') {
      const q = db.claimQuest(userId);
      if (!q) {
        const cur = db.getQuest(userId);
        return message.channel.send({ embeds: [error(cur.claimed ? 'you already claimed today\'s quest!' : `quest not done yet — **${cur.progress}/${cur.target}** ${QUEST_LABELS[cur.key]}`)] });
      }
      return message.channel.send({ embeds: [success(`quest complete! claimed **${q.reward.toLocaleString()}** ${config.currency} 💰`) ] });
    }

    const q = db.getQuest(userId);
    const pct = Math.min(100, Math.floor((q.progress / q.target) * 100));
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    return message.channel.send({ embeds: [embed('📜 Daily Quest', [
      ['Task', `**${q.progress.toLocaleString()}/${q.target.toLocaleString()}** ${QUEST_LABELS[q.key]}`],
      ['Progress', `${bar} **${pct}%**`],
      ['Reward', `**${q.reward.toLocaleString()}** ${config.currency}`],
      ['', q.claimed ? 'claimed for today — come back tomorrow!' : '`v quest claim` when done'],
    ], 0x57f287)] });
  },
};
