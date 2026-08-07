const db = require('../db');
const { embed, error } = require('../utils/embed');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '👑' };
const TRAIT_EMOJIS = { Brave: '⚔️', Chill: '🧊', Eager: '⚡', Lucky: '🍀', Calm: '🌊' };

function findAnimal(userId, query) {
  const all = db.getUserAnimals(userId);
  if (!all.length) return null;

  const id = parseInt(query, 10);
  if (!isNaN(id)) return all.find(a => a.id === id) || null;

  const q = query.toLowerCase();
  const bySpecies = all.filter(a => a.species.toLowerCase() === q);
  if (bySpecies.length) return bySpecies.sort((a, b) => b.level - a.level)[0];

  const byName = all.filter(a => a.name !== 'Unnamed' && a.name.toLowerCase() === q);
  if (byName.length) return byName.sort((a, b) => b.level - a.level)[0];

  return null;
}

module.exports = {
  name: 'animal',
  helpCategory: 'Pets',
  helpArgs: '<id | species | name>',
  aliases: ['pet', 'info', 'stats'],
  description: 'view an animal\'s full stats (hp, attack, defense, xp) — by id, species, or name',
  execute(message, args) {
    if (!args.length) return message.channel.send({ embeds: [error('give an animal id, species, or name — e.g. `v animal 5` or `v animal dragon` or `v animal rex`')] });

    const a = findAnimal(message.author.id, args.join(' '));
    if (!a) return message.channel.send({ embeds: [error('no animal of yours matches that — find ids with `v zoo`')] });

    const xpNeed = db.expForLevel(a.level);
    const xpPct = Math.min(100, Math.floor((a.exp / xpNeed) * 100));
    const bar = '█'.repeat(Math.floor(xpPct / 10)) + '░'.repeat(10 - Math.floor(xpPct / 10));

const team = db.getTeam(message.author.id);
    const onTeam = team && [team.slot1, team.slot2, team.slot3].includes(a.id);
    const fed = db.isFed(a);
    const traitEmoji = TRAIT_EMOJIS[a.trait];
    const achers = db.PET_ACHIEVEMENTS;
    const achersList = db.petAchievementsFor(a.id);
    const achievLine = achersList.length
      ? achersList.map(pa => `${achers[pa.key] ? achers[pa.key].name : pa.key}`).join('\n')
      : 'none yet';

    message.channel.send({ embeds: [embed(`${RARITY_EMOJIS[a.rarity]} ${a.name !== 'Unnamed' ? `${a.name} the ` : ''}${a.species}`, [
      ['Info', `${a.rarity.toUpperCase()} · Lv.**${a.level}** · \`#${a.id}\`${onTeam ? ' · 🛡️ on battle team' : ''}${a.shiny ? '\n✨ **SHINY** (2x sell price)' : ''}\npersonality: ${traitEmoji || ''} **${a.trait || 'none'}**${fed ? '\n🍖 **fed** (+10% battle stats)' : ''}`],
      ['Combat', `${traitEmoji || ''} **${a.hp}**/${a.max_hp} HP\n🗡️ **${a.attack}** attack\n🛡️ **${a.defense}** defense`],
      ['XP', `${bar} **${a.exp}/${xpNeed}** (${xpPct}%)`],
      ['Pet Achievements', achievLine],
      ['', `\`v team\` to put it on your battle team · \`v rename ${a.id} <name>\` to name it · \`v feed ${a.id}\` · \`v evolve ${a.id}\``],
    ], 0x57f287)] });
  },
};
