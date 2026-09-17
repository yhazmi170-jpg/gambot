const db = require('../db');
const { embed, error } = require('../utils/embed');
const { collectStats } = require('../utils/playerstats');

const TITLES_POOL = [
  'professional egg accountant', 'licensed tree watcher', 'self-employed nap consultant',
  'head of unconfirmed rumors', 'bureau of unrequested opinions', 'certified held accountable guy',
  'freelance spot checker', 'regional snack inspector', 'deputy of chill', 'assistant to the assistant',
];

const CRIMES_POOL = [
  'running an underground snail ring', 'excessive neatness in the zoo',
  'harboring unhatched fugitives', 'standing suspiciously happy', 'conspiring to touch grass',
  'public overcollection of gems', 'operating a non-compliant nap operation',
  'possession of unlicensed vibes', 'organizing a surprise party without paperwork',
  'being on the same leaderboard as me', 'top-secret stash of 2+ shiny pets',
];

const EVIDENCE_POOL = [
  'was seen holding a snack of unclear origin', 'fingerprints found on the seasonal button',
  'the trail of essence leads directly to them', 'their pet denied everything',
  'witness reports they looked innocent (too innocent)', 'found meowing near the rare spawn point',
  'their reputation score is unexplained', 'they know too much about hunt vibes',
];

module.exports = {
  name: 'case',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'Gambot opens a totally real case file about someone (it is fake)',
  aliases: ['cases', 'file'],
  execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    const s = collectStats(target.id);
    if (!s.animals && !s.balance && !db.getActivity(target.id)) {
      return message.channel.send({ embeds: [error('file not found — that user has no Gambot records yet')] });
    }
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const occupation = s.eggs > 2 ? 'professional egg accountant'
      : s.gems > 10000 ? 'regional gem overseer'
      : s.animals === 0 ? 'self-employed nap consultant'
      : s.battleWins > 10 ? 'certified battle tabulator'
      : TITLES_POOL[Math.floor(Math.random() * TITLES_POOL.length)];
    const days = s.firstSeen ? Math.max(1, Math.round((Date.now() / 1000 - s.firstSeen) / 86400)) : 0;
    const speciesPct = Math.round((s.speciesCount / s.speciesTotal) * 100);

    const fields = [
      ['Subject', `<@${target.id}>`],
      ['Occupation', occupation],
      ['Record', `**level ${s.level}** · **${s.animals}** pets · **${speciesPct}%** dex · **${s.balance.toLocaleString()}** coins banking`],
      ['Suspected Crime', pick(CRIMES_POOL)],
      ['Evidence', pick(EVIDENCE_POOL)],
      ['Judicial Record', `**${s.judged}** time(s) on the bench`],
      ['','if ur reading this the case is legally fictional. do not ask follow-ups.'],
    ];
    if (days) fields.splice(5, 0, ['Time on Record', `**${days}d** of unexplained presence`]);

    message.channel.send({ embeds: [embed('🚨 Case File', fields, 0x2b2d31)] });
  },
};