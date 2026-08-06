const db = require('../db');
const { embed, error } = require('../utils/embed');
const { renderBattleImage } = require('../utils/battleImage');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const pendingBattles = new Map();

function errEmbed(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(text);
}
function okEmbed(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(text);
}

async function runBattle(message, target) {
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
    db.addQuestProgress(winner.id, 'battle', 1);
    db.addBountyProgress(winner.id, 'battle', 1);
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
}

async function handleInteraction(i) {
  try {
    if (!i.customId.startsWith('battle_')) return;
    const isNo = i.customId.endsWith('_no');
    const id = i.customId.replace('battle_', '').replace(/_(yes|no)$/, '');
    const pending = pendingBattles.get(id);
    if (!pending) {
      await i.update({ embeds: [errEmbed('This battle request has expired.')], components: [] });
      return;
    }
    if (i.user.id !== pending.target.id) {
      await i.deferUpdate().catch(() => {});
      return;
    }
    pendingBattles.delete(id);
    clearTimeout(pending.timeout);

    if (isNo) {
      await i.update({ embeds: [okEmbed(`Battle request declined.`)], components: [] });
      return;
    }

    await i.update({ embeds: [okEmbed('⚔️ Starting battle...')], components: [] });
    await runBattle(pending.message, pending.target);
  } catch (e) {
    console.error('battle interaction err:', e);
    try { await i.deferUpdate().catch(() => {}); } catch (_) {}
  }
}

module.exports = {
  name: 'battle',
  helpCategory: 'Pets',
  helpArgs: '<@user>',
  aliases: ['b', 'fight'],
  description: 'battle another user\'s team',
  handleInteraction,
  async execute(message, args) {
    const target = message.mentions.users.first();
    if (!target || target.bot) return message.channel.send({ embeds: [error('mention someone to battle')] });
    if (target.id === message.author.id) return message.channel.send({ embeds: [error('you can\'t battle yourself')] });

    const myTeam = db.getTeam(message.author.id);
    const theirTeam = db.getTeam(target.id);
    if (!myTeam || (!myTeam.slot1 && !myTeam.slot2 && !myTeam.slot3)) return message.channel.send({ embeds: [error('your team is empty — use `v team add`')] });
    if (!theirTeam || (!theirTeam.slot1 && !theirTeam.slot2 && !theirTeam.slot3)) return message.channel.send({ embeds: [error(`${target.username}'s team is empty`) ] });

    const id = `${message.author.id}_${target.id}_${Date.now()}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`battle_${id}_yes`).setLabel('⚔️ Fight').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`battle_${id}_no`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
    );

    const sent = await message.channel.send({
      embeds: [embed('⚔️ Battle Request', [
        ['Challenger', `${message.author} (${message.author.username})`],
        ['Opponent', `${target} (${target.username})`],
        ['', `${message.author} wants to battle ${target}!\n${target}, **Fight** to accept or **Cancel** to decline.`],
      ], 0x2b2d31)],
      components: [row],
    });

    const timeout = setTimeout(async () => {
      if (pendingBattles.has(id)) {
        pendingBattles.delete(id);
        try { await sent.edit({ embeds: [errEmbed('Battle request expired.')], components: [] }); } catch (_) {}
      }
    }, 60000);

    pendingBattles.set(id, { challenger: message.author, target, message, timeout });
  },
};
