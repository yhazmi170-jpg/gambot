const db = require('../db');
const { embed, error } = require('../utils/embed');
const { getSpeciesImage } = require('../utils/speciesImages');

const RARITY_EMOJIS = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

function hpBar(pet) {
  const max = pet.max_hp || pet.hp || 1;
  const pct = Math.max(0, Math.min(1, pet.hp / max));
  const total = 10;
  const filled = Math.round(pct * total);
  return '▰'.repeat(filled) + '▱'.repeat(total - filled);
}

function petEmbed(pet, label) {
  const alive = pet.hp > 0;
  const img = getSpeciesImage(pet.species);
  const e = new (require('discord.js').EmbedBuilder)()
    .setColor(alive ? 0x57f287 : 0xed4245)
    .setTitle(`${alive ? '🟢' : '❌'} ${pet.species} — Lv.${pet.level}`)
    .setDescription(
      `${label}\n` +
      `\`${hpBar(pet)}\` **${pet.hp}/${pet.max_hp || pet.hp}** (${Math.round((pet.hp / (pet.max_hp || pet.hp || 1)) * 100)}%)\n` +
      `⚔️ ${pet.attack}   🛡️ ${pet.defense}`
    );
  if (img) e.setImage(img);
  return e;
}

module.exports = {
  name: 'battle',
  helpCategory: 'Pets',
  helpArgs: '<@user>',
  aliases: ['b', 'fight'],
  description: 'battle another user\'s team',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target || target.bot) return message.channel.send({ embeds: [error('mention someone to battle')] });
    if (target.id === message.author.id) return message.channel.send({ embeds: [error('you can\'t battle yourself')] });

    const myTeam = db.getTeam(message.author.id);
    const theirTeam = db.getTeam(target.id);
    if (!myTeam || (!myTeam.slot1 && !myTeam.slot2 && !myTeam.slot3)) return message.channel.send({ embeds: [error('your team is empty — use `v team add`')] });
    if (!theirTeam || (!theirTeam.slot1 && !theirTeam.slot2 && !theirTeam.slot3)) return message.channel.send({ embeds: [error(`${target.username}'s team is empty`) ] });

    const myPets = [myTeam.slot1, myTeam.slot2, myTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
    const theirPets = [theirTeam.slot1, theirTeam.slot2, theirTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
    if (!myPets.length || !theirPets.length) return message.channel.send({ embeds: [error('one of the teams has no valid animals')] });

    const myCopy = myPets.map(p => ({ ...p }));
    const theirCopy = theirPets.map(p => ({ ...p }));

    let log = [];
    let round = 0;
    while (myCopy.some(p => p.hp > 0) && theirCopy.some(p => p.hp > 0) && round < 50) {
      round++;
      const myAlive = myCopy.filter(p => p.hp > 0);
      const theirAlive = theirCopy.filter(p => p.hp > 0);

      for (const pet of myAlive) {
        if (!theirAlive.length) break;
        const t = theirAlive.reduce((a, b) => a.hp < b.hp ? a : b);
        const dmg = Math.max(0, pet.attack - Math.floor(t.defense / 2) + Math.floor(Math.random() * 10));
        t.hp = Math.max(0, t.hp - dmg);
        log.push(`**${pet.species}** deals ${dmg} damage to **${t.species}** (${t.hp} HP left)`);
        if (t.hp <= 0) log.push(`❌ **${t.species}** fainted!`);
      }

      for (const pet of theirCopy.filter(p => p.hp > 0)) {
        const myAliveNow = myCopy.filter(p => p.hp > 0);
        if (!myAliveNow.length) break;
        const t = myAliveNow.reduce((a, b) => a.hp < b.hp ? a : b);
        const dmg = Math.max(0, pet.attack - Math.floor(t.defense / 2) + Math.floor(Math.random() * 10));
        t.hp = Math.max(0, t.hp - dmg);
        log.push(`**${pet.species}** deals ${dmg} damage to **${t.species}** (${t.hp} HP left)`);
        if (t.hp <= 0) log.push(`❌ **${t.species}** fainted!`);
      }
    }

    const myAlive = myCopy.filter(p => p.hp > 0).length;
    const theirAlive = theirCopy.filter(p => p.hp > 0).length;
    let winner, loser;
    if (myAlive > theirAlive) { winner = message.author; loser = target; }
    else if (theirAlive > myAlive) { winner = target; loser = message.author; }
    else { winner = null; loser = null; }

    const embeds = [];
    embeds.push(embed(`${message.author.username} goes into battle!`, [
      ['Your Team', myPets.map(p => `Lv.${p.level} ${RARITY_EMOJIS[p.rarity] || ''} ${p.species}`).join('\n'), true],
      ['Enemy Team', theirPets.map(p => `Lv.${p.level} ${RARITY_EMOJIS[p.rarity] || ''} ${p.species}`).join('\n'), true],
    ], 0x2b2d31));

    myPets.forEach((p, i) => {
      const live = myCopy.find(x => x.id === p.id) || p;
      embeds.push(petEmbed(live, `Your pet`));
    });
    theirPets.forEach((p, i) => {
      const live = theirCopy.find(x => x.id === p.id) || p;
      embeds.push(petEmbed(live, `Enemy pet`));
    });

    if (winner) {
      const reward = 50 + myPets.length * 10;
      db.payWin(winner.id, reward);

      for (const pet of myPets) {
        const survived = myCopy.find(p => p.id === pet.id);
        if (survived && survived.hp > 0) db.addExp(pet.id, 20);
        else db.addExp(pet.id, 5);
      }
      for (const pet of theirPets) {
        const survived = theirCopy.find(p => p.id === pet.id);
        if (survived && survived.hp > 0) db.addExp(pet.id, 20);
        else db.addExp(pet.id, 5);
      }

      const logText = log.slice(-8).join('\n');
      embeds.push(embed('⚔️ Battle Results', [
        ['Winner', `${winner} (owned by ${winner.username})`],
        ['Prize', `**${reward}** ${require('../config').currency}`],
        ['', logText || 'a close fight!'],
      ], 0xe74c3c));
    } else {
      embeds.push(embed('⚔️ Battle Results', [
        ['Draw', 'both teams fought bravely!'],
        ['', log.slice(-5).join('\n')],
      ], 0x95a5a6));
    }

    message.channel.send({ embeds });
  },
};
