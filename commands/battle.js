const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'battle',
  helpCategory: 'Pets',
  helpArgs: '<@user>',
  aliases: ['b', 'fight'],
  description: 'battle another user\'s team',
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target || target.bot) return message.channel.send({ embeds: [require('../utils/embed').error('mention someone to battle')] });
    if (target.id === message.author.id) return message.channel.send({ embeds: [require('../utils/embed').error('you can\'t battle yourself')] });

    const myTeam = db.getTeam(message.author.id);
    const theirTeam = db.getTeam(target.id);
    if (!myTeam || (!myTeam.slot1 && !myTeam.slot2 && !myTeam.slot3)) return message.channel.send({ embeds: [require('../utils/embed').error('your team is empty — use `v team add`')] });
    if (!theirTeam || (!theirTeam.slot1 && !theirTeam.slot2 && !theirTeam.slot3)) return message.channel.send({ embeds: [require('../utils/embed').error(`${target.username}'s team is empty`) ] });

    const myPets = [myTeam.slot1, myTeam.slot2, myTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
    const theirPets = [theirTeam.slot1, theirTeam.slot2, theirTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
    if (!myPets.length || !theirPets.length) return message.channel.send({ embeds: [require('../utils/embed').error('one of the teams has no valid animals')] });

    const myCopy = myPets.map(p => ({ ...p }));
    const theirCopy = theirPets.map(p => ({ ...p }));

    let log = [];
    let round = 0;
    while (myCopy.some(p => p.hp > 0) && theirCopy.some(p => p.hp > 0) && round < 50) {
      round++;
      const myAlive = myCopy.filter(p => p.hp > 0);
      const theirAlive = theirCopy.filter(p => p.hp > 0);

      // my pets attack
      for (const pet of myAlive) {
        if (!theirAlive.length) break;
        const target = theirAlive.reduce((a, b) => a.hp < b.hp ? a : b);
        const dmg = Math.max(0, pet.attack - Math.floor(target.defense / 2) + Math.floor(Math.random() * 10));
        target.hp = Math.max(0, target.hp - dmg);
        log.push(`**${pet.species}** deals ${dmg} damage to **${target.species}** (${target.hp} HP left)`);
        if (target.hp <= 0) log.push(`❌ **${target.species}** fainted!`);
      }

      // their pets attack
      for (const pet of theirCopy.filter(p => p.hp > 0)) {
        const myAliveNow = myCopy.filter(p => p.hp > 0);
        if (!myAliveNow.length) break;
        const target = myAliveNow.reduce((a, b) => a.hp < b.hp ? a : b);
        const dmg = Math.max(0, pet.attack - Math.floor(target.defense / 2) + Math.floor(Math.random() * 10));
        target.hp = Math.max(0, target.hp - dmg);
        log.push(`**${pet.species}** deals ${dmg} damage to **${target.species}** (${target.hp} HP left)`);
        if (target.hp <= 0) log.push(`❌ **${target.species}** fainted!`);
      }
    }

    const myAlive = myCopy.filter(p => p.hp > 0).length;
    const theirAlive = theirCopy.filter(p => p.hp > 0).length;
    let winner, loser;
    if (myAlive > theirAlive) { winner = message.author; loser = target; }
    else if (theirAlive > myAlive) { winner = target; loser = message.author; }
    else { winner = null; loser = null; }

    if (winner) {
      const reward = 50 + myPets.length * 10;
      db.payWin(winner.id, reward);

      // add exp to surviving pets
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
      return message.channel.send({
        embeds: [embed('⚔️ Battle Results', [
          ['Winner', `${winner}`],
          ['Prize', `**${reward}** ${require('../config').currency}`],
          ['', logText || 'a close fight!'],
        ], 0xe74c3c)],
      });
    }

    message.channel.send({
      embeds: [embed('⚔️ Battle Results', [
        ['Draw', 'both teams fought bravely!'],
        ['', log.slice(-5).join('\n')],
      ], 0x95a5a6)],
    });
  },
};
