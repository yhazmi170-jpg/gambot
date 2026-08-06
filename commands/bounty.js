const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

const BOUNTY_LABELS = {
  hunt: 'hunt animals',
  sacrifice: 'sacrifice animals',
  win: 'win coins from games',
  work: 'work shifts',
  give: 'give coins to other players',
  battle: 'win battles',
};

module.exports = {
  name: 'bounty',
  helpCategory: 'Economy',
  helpArgs: '',
  description: 'view your weekly bounty — a big challenge for big coins',
  aliases: ['bnt'],
  execute(message, args) {
    const userId = message.author.id;
    const cmd = (args[0] || '').toLowerCase();

    if (cmd === 'claim') {
      const b = db.claimBounty(userId);
      if (!b) {
        const cur = db.getBounty(userId);
        return message.channel.send({ embeds: [error(cur.claimed ? 'you already claimed this week\'s bounty!' : `bounty not done yet — **${cur.progress}/${cur.target}** ${BOUNTY_LABELS[cur.key]}`)] });
      }
      return message.channel.send({ embeds: [success(`bounty complete! claimed **${b.reward.toLocaleString()}** ${config.currency} 💰`) ] });
    }

    const b = db.getBounty(userId);
    const pct = Math.min(100, Math.floor((b.progress / b.target) * 100));
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    return message.channel.send({ embeds: [embed('🎯 Weekly Bounty', [
      ['Task', `**${b.progress.toLocaleString()}/${b.target.toLocaleString()}** ${BOUNTY_LABELS[b.key]}`],
      ['Progress', `${bar} **${pct}%**`],
      ['Reward', `**${b.reward.toLocaleString()}** ${config.currency}`],
      ['', b.claimed ? 'claimed for this week — resets next week!' : '`v bounty claim` when done'],
    ], 0xf1c40f)] });
  },
};
