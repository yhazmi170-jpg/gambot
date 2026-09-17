const db = require('../db');
const { embed, error } = require('../utils/embed');
const { collectStats } = require('../utils/playerstats');

const VERDICTS = [
  'guilty of being a whole lot going on', 'chaotic, absolutely chaotic',
  'the courts technically cannot hold them', 'guilty of building a really weird zoo',
  'not guilty — the vibes were adequate', 'sentenced to vibes',
  'guilty of rarepets. we allow it though', 'acquitted due to excessive cuteness',
];

module.exports = {
  name: 'judge',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'Gambot passes a legally non-binding fictional sentence',
  aliases: ['court'],
  execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    const s = collectStats(target.id);
    if (!db.getActivity(target.id)) {
      return message.channel.send({ embeds: [error('no court records yet — that user has not appeared')] });
    }
    db.bumpCounter(message.author.id, 'judged');

    const verdict = VERDICTS[Math.floor(Math.random() * VERDICTS.length)];
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const charge = s.eggs > 2
      ? `hoarding **${s.eggs} unhatched eggs** in broad daylight`
      : s.social > 10
        ? `being chronically social (v${s.social} interactions)`
        : s.animals === 0
          ? 'owning zero pets in a pet economy'
          : `unspecified allegations from level ${s.level}`;
    const sentence = pick([
      'hard labor of 3 zoos', 'a stern lecture from my lawyer', 'one (1) notebook of apologies',
      'community dewclaw service', 'a single concerning thumbs up', 'recess, indefinitely',
    ]);

    message.channel.send({
      embeds: [embed('⚖️ Court is in Session', [
        ['Defendant', `<@${target.id}>`],
        ['Charge', charge],
        ['Verdict', verdict],
        ['Sentence', sentence],
        ['', 'all of this is fictional court. do not cite this.'],
      ], 0x2b2d31)],
    });
  },
};