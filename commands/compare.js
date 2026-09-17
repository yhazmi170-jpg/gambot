const db = require('../db');
const { embed, error } = require('../utils/embed');
const { collectStats } = require('../utils/playerstats');

function statLine(label, me, you) {
  const mine = typeof me === 'number' ? me.toLocaleString() : me;
  const theirs = typeof you === 'number' ? you.toLocaleString() : you;
  return `${label}: **${mine}** vs **${theirs}**`;
}

function commentary(me, you) {
  const lines = [];
  const num = (fn) => {
    const a = fn(me), b = fn(you);
    return [a, b];
  };
  const [myN, yourN] = num(s => s.animals);
  const [myS, yourS] = num(s => s.speciesCount);
  const [mySeal, yourSeal] = num(s => s.seals);
  if (myN > yourN + 5) lines.push(`they run a **mega zoo** — ${myN} pets is not a hobby it is a responsibility`);
  else if (yourN > myN + 5) lines.push(`ur outnumbered ${myN} vs ${yourN} pets. this is why they win arguments`);
  else lines.push(`u two are evenly matched on critters — maybe compare vibes instead`);

  if (myS > yourS) lines.push(`wider dex collection (${myS} species) — the catalog favors u`);
  else if (yourS > myS) lines.push(`they own more species (${yourS}) — ur dex has catching up to do`);

  if (mySeal > yourSeal + 5) lines.push(`u out-seal them ${mySeal}–${yourSeal}. the seals do not lie`);
  else if (yourSeal > mySeal + 5) lines.push(`theyve banked ${yourSeal} seals. impressive. worrying.`);

  lines.push(mySeal === yourSeal && myS === yourS && myN === yourN ? 'u r identical. scary.' : 'the comparison machine has spoken. no appeals.');
  return lines.slice(0, 4).join('\n');
}

module.exports = {
  name: 'compare',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'compare real Gambot stats + certified commentary',
  aliases: ['cmp', 'versus'],
  execute(message, args) {
    const you = message.mentions.users.first() || message.author;
    const me = collectStats(message.author.id);
    const them = collectStats(you.id);
    if (!db.getActivity(you.id)) {
      return message.channel.send({ embeds: [error('no records for that user yet — invent some first')] });
    }
    const lines = [
      statLine('Level', me.level, them.level),
      statLine('Pets', me.animals, them.animals),
      statLine('Dex Species', me.speciesCount, them.speciesCount),
      statLine('Gems', me.gems, them.gems),
      statLine('Seals', me.seals, them.seals),
      statLine('Battle Wins', me.battleWins, them.battleWins),
      statLine('Titles', me.titlesOwned, them.titlesOwned),
      statLine('Social Rank', me.social, them.social),
    ];
    message.channel.send({
      embeds: [embed(`⚔️ ${message.author.username} vs ${you.username}`, [
        ['Real Stats', lines.join('\n')],
        ['Commentary', commentary(me, them)],
        ['', 'stats are real. commentary is fabricated. proceed with both.'],
      ], 0x2b2d31)],
    });
  },
};