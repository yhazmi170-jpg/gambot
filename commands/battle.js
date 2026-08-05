const db = require('../db');
const { error } = require('../utils/embed');
const { renderBattleImage } = require('../utils/battleImage');

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
    let winner;
    if (myAlive > theirAlive) winner = message.author;
    else if (theirAlive > myAlive) winner = target;
    else winner = null;

    const result = winner ? (winner.id === message.author.id ? `YOU WIN! +${20 * myPets.filter(p => myCopy.find(x => x.id === p.id) && myCopy.find(x => x.id === p.id).hp > 0).length} XP` : `YOU LOSE!`) : 'DRAW!';

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
    }

    const img = renderBattleImage({
      playerName: message.author.username,
      enemyName: target.username,
      myPets: myCopy,
      theirPets: theirCopy,
      turns: round,
      result,
    });

    return message.channel.send({
      files: [{ attachment: img, name: 'battle.png' }],
    });
  },
};
