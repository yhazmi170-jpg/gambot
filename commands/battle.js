const db = require('../db');
const { embed, error } = require('../utils/embed');
const { renderBattleImage } = require('../utils/battleImage');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function errEmbed(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(text);
}
function okEmbed(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(text);
}

function pendingKey(authorId, targetId, ts) {
  return `${authorId}_${targetId}_${ts}`;
}

function battleMods(pet) {
  let atkMod = 1;
  let defMod = 1;
  if (db.isFed(pet)) { atkMod += 0.1; defMod += 0.1; }
  if (pet.trait === 'Brave') atkMod += 0.1;
  else if (pet.trait === 'Chill') defMod += 0.1;
  else if (pet.trait === 'Eager') { atkMod += 0.05; defMod += 0.05; }
  else if (pet.trait === 'Lucky') atkMod += 0.15;
  else if (pet.trait === 'Calm') atkMod += 0.03;
  return {
    effAtk: Math.floor((pet.attack || 0) * atkMod),
    effDef: Math.floor((pet.defense || 0) * defMod),
  };
}

async function runBattle(message, target) {
  const myTeam = db.getTeam(message.author.id);
  const theirTeam = db.getTeam(target.id);
  if (!myTeam || (!myTeam.slot1 && !myTeam.slot2 && !myTeam.slot3)) return message.channel.send({ embeds: [error('your team is empty — use `v team add`')] });
  if (!theirTeam || (!theirTeam.slot1 && !theirTeam.slot2 && !theirTeam.slot3)) return message.channel.send({ embeds: [error(`${target.username}'s team is empty`) ] });

  const myPets = [myTeam.slot1, myTeam.slot2, myTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
  const theirPets = [theirTeam.slot1, theirTeam.slot2, theirTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
  if (!myPets.length || !theirPets.length) return message.channel.send({ embeds: [error('one of the teams has no valid animals')] });

  const myCopy = myPets.map(p => ({ ...p, ...battleMods(p) }));
  const theirCopy = theirPets.map(p => ({ ...p, ...battleMods(p) }));

  let log = [];
  let round = 0;
  while (myCopy.some(p => p.hp > 0) && theirCopy.some(p => p.hp > 0) && round < 50) {
    round++;
    const myAlive = myCopy.filter(p => p.hp > 0);
    const theirAlive = theirCopy.filter(p => p.hp > 0);

    for (const pet of myAlive) {
      if (!theirAlive.length) break;
const t = theirAlive.reduce((a, b) => a.hp < b.hp ? a : b);
      const dmg = Math.max(0, pet.effAtk - Math.floor(t.effDef / 2) + Math.floor(Math.random() * 10));
      t.hp = Math.max(0, t.hp - dmg);
      log.push(`**${pet.species}** deals ${dmg} damage to **${t.species}** (${t.hp} HP left)`);
      if (t.hp <= 0) log.push(`💀 **${t.species}** fainted!`);
    }

    for (const pet of theirCopy.filter(p => p.hp > 0)) {
      const myAliveNow = myCopy.filter(p => p.hp > 0);
      if (!myAliveNow.length) break;
      const t = myAliveNow.reduce((a, b) => a.hp < b.hp ? a : b);
      const dmg = Math.max(0, pet.effAtk - Math.floor(t.effDef / 2) + Math.floor(Math.random() * 10));
      t.hp = Math.max(0, t.hp - dmg);
      log.push(`**${pet.species}** deals ${dmg} damage to **${t.species}** (${t.hp} HP left)`);
      if (t.hp <= 0) log.push(`💀 **${t.species}** fainted!`);
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
    const wins = db.addBattleWin(winner.id);
    const winnerPets = winner.id === message.author.id ? myPets : theirPets;
    for (const pet of winnerPets) {
      db.awardPetAchievement(pet.id, 'battle_first');
      if (wins >= 10) db.awardPetAchievement(pet.id, 'battle_10');
    }
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
    const pending = db.getPendingBattle(id);
    if (!pending || pending.expires_at < Math.floor(Date.now() / 1000)) {
      if (pending) db.deletePendingBattle(id);
      await i.update({ embeds: [errEmbed('This battle request has expired.')], components: [] });
      return;
    }
    if (i.user.id !== pending.target_id) {
      await i.deferUpdate().catch(() => {});
      return;
    }
    db.deletePendingBattle(id);

    if (isNo) {
      await i.update({ embeds: [okEmbed(`Battle request declined.`)], components: [] });
      return;
    }

    await i.update({ embeds: [okEmbed('⚔️ Starting battle...')], components: [] });

    const challenger = await i.client.users.fetch(pending.challenger_id).catch(() => null);
    if (!challenger) return;
    await runBattle({ author: challenger, channel: i.message.channel, guild: i.message.guild }, i.user);
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

    const id = pendingKey(message.author.id, target.id, Date.now());
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

    db.setPendingBattle(id, message.author.id, target.id, Math.floor(Date.now() / 1000) + 60);

    setTimeout(async () => {
      const p = db.getPendingBattle(id);
      if (p) {
        db.deletePendingBattle(id);
        try { await sent.edit({ embeds: [errEmbed('Battle request expired.')], components: [] }); } catch (_) {}
      }
    }, 60000);
  },
};
