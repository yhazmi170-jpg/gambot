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

  // Equipped weapon: flat attack/defense added after the % modifiers.
  const weapon = pet._weapon || null;
  let atkBonus = 0;
  let defBonus = 0;
  if (weapon) {
    atkBonus = weapon.atk || 0;
    defBonus = weapon.def || 0;
    if (weapon.type === 'aegis') defBonus += Math.floor((weapon.atk || 0) * 0.9); // aegis leans into defense
  }
  return {
    effAtk: Math.floor((pet.attack || 0) * atkMod) + atkBonus,
    effDef: Math.floor((pet.defense || 0) * defMod) + defBonus,
  };
}

// Attach each pet's equipped weapon for the battle.
function attachWeapons(pet) {
  const w = db.getAnimalWeapon(pet.id);
  const copy = { ...pet };
  if (w) copy._weapon = w;
  return copy;
}

// Holds per-pet status effect state for a battle: { poison: turns, flame: turns, taunt: bool }
function makeStatuses(pets) {
  const s = {};
  for (const p of pets) s[p.id] = { poison: 0, flame: 0, taunt: false };
  return s;
}

async function runBattle(message, target) {
  const myTeam = db.getTeam(message.author.id);
  const theirTeam = db.getTeam(target.id);
  if (!myTeam || (!myTeam.slot1 && !myTeam.slot2 && !myTeam.slot3)) return message.channel.send({ embeds: [error('your team is empty — use `v team add`')] });
  if (!theirTeam || (!theirTeam.slot1 && !theirTeam.slot2 && !theirTeam.slot3)) return message.channel.send({ embeds: [error(`${target.username}'s team is empty`) ] });

  const myPets = [myTeam.slot1, myTeam.slot2, myTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
  const theirPets = [theirTeam.slot1, theirTeam.slot2, theirTeam.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean);
  if (!myPets.length || !theirPets.length) return message.channel.send({ embeds: [error('one of the teams has no valid animals')] });

  const myCopy = myPets.map(p => { const wp = attachWeapons(p); return { ...wp, ...battleMods(wp) }; });
  const theirCopy = theirPets.map(p => { const wp = attachWeapons(p); return { ...wp, ...battleMods(wp) }; });
  const myStatus = makeStatuses(myCopy);
  const theirStatus = makeStatuses(theirCopy);

  // damage helper with weapon effect hooks
  function doDamage(attacker, target, side, myPetsArr, theirPetsArr, log, statuses) {
    const weapon = attacker._weapon;
    const power = weapon ? 0.6 + (weapon.quality / 100) * 0.8 : 0;
    const dmg = Math.max(0, attacker.effAtk - Math.floor(target.effDef / 2) + Math.floor(Math.random() * 10));

    let dealt = dmg;
    let note = '';
    if (weapon && weapon.type === 'poison_dagger') { statuses[target.id].poison = 3; note = ' ☠️ **poisoned!**'; }
    if (weapon && weapon.type === 'flame_staff') { statuses[target.id].flame = 3; note = ' 🔥 **burned!**'; }
    if (weapon && weapon.type === 'vamp_staff') {
      const heal = Math.floor(dmg * (0.2 + power * 0.2));
      attacker.hp = Math.min(attacker.max_hp, attacker.hp + heal);
      note = ` 🩸 **lifesteal +${heal}**`;
    }
    if (weapon && weapon.type === 'aegis') { statuses[attacker.id].taunt = true; note = ' 🛡️ **now taunting!**'; }
    target.hp = Math.max(0, target.hp - dealt);
    log.push(`**${attacker.species}**${weapon ? ' ' + weapon.emoji : ''} deals ${dealt} damage to **${target.species}** (${target.hp} HP left)${note}`);
    if (target.hp <= 0) log.push(`💀 **${target.species}** fainted!`);
    return dealt;
  }

  // apply DoT (poison/flame) at the start of a side's turn
  function applyDot(pets, statuses, log) {
    for (const p of pets) {
      if (p.hp <= 0) continue;
      const s = statuses[p.id];
      let dotLabel = '';
      let dot = 0;
      if (s.poison > 0) { dot += Math.floor(p.max_hp * 0.05) + 3; s.poison--; dotLabel = '☠️ poison'; }
      if (s.flame > 0) { dot += Math.floor(p.max_hp * 0.04) + 3; s.flame--; dotLabel = (dotLabel ? dotLabel + ' + ' : '') + '🔥 burn'; }
      if (dot > 0) {
        p.hp = Math.max(0, p.hp - dot);
        log.push(`**${p.species}** takes ${dot} from ${dotLabel} (${p.hp} HP left)`);
        if (p.hp <= 0) log.push(`💀 **${p.species}** fainted!`);
      }
    }
  }

  let log = [];
  let round = 0;
  while (myCopy.some(p => p.hp > 0) && theirCopy.some(p => p.hp > 0) && round < 50) {
    round++;
    const myAlive = myCopy.filter(p => p.hp > 0);
    const theirAlive = theirCopy.filter(p => p.hp > 0);

    // my turn: apply my DoT, taunt check, heal-staff heal, then attack
    applyDot(myAlive, myStatus, log);
    // heal staff: heal weakest of own side before attacking
    const myHealer = myAlive.find(p => p._weapon && p._weapon.type === 'heal_staff');
    if (myHealer && myAlive.length > 1) {
      const weakest = myAlive.filter(x => x.id !== myHealer.id).sort((a, b) => a.hp - b.hp)[0];
      const powerH = 0.6 + (myHealer._weapon.quality / 100) * 0.8;
      const healAmt = Math.floor(myHealer.effAtk * (0.3 + powerH * 0.3)) + 5;
      if (weakest.hp > 0) { weakest.hp = Math.min(weakest.max_hp, weakest.hp + healAmt); log.push(`💚 **${myHealer.species}** heals **${weakest.species}** +${healAmt}`); }
    }
    const myAliveAfterDot = myCopy.filter(p => p.hp > 0);
    const theirAliveForAtk = theirCopy.filter(p => p.hp > 0);
    for (const pet of myAliveAfterDot) {
      if (!theirAliveForAtk.length) break;
      if (pet._weapon && pet._weapon.type === 'great_sword') {
        // splash: hit every alive enemy (each with slightly reduced damage)
        for (const en of [...theirAliveForAtk]) {
          if (en.hp <= 0) continue;
          const dmg = Math.max(0, pet.effAtk - Math.floor(en.effDef / 2) + Math.floor(Math.random() * 10));
          const splashed = Math.floor(dmg * 0.7);
          en.hp = Math.max(0, en.hp - splashed);
          log.push(`⚔️ **${pet.species}** sweeps **${en.species}** for ${splashed} (${en.hp} HP left)`);
          if (en.hp <= 0) log.push(`💀 **${en.species}** fainted!`);
        }
        continue;
      }
      // taunt (aegis) redirects attacks to the taunter
      const taunter = theirAliveForAtk.find(t => theirStatus[t.id] && theirStatus[t.id].taunt);
      const t = taunter || theirAliveForAtk.reduce((a, b) => a.hp < b.hp ? a : b);
      if (taunter) { theirStatus[taunter.id].taunt = false; }
      doDamage(pet, t, 'my', myAliveAfterDot, theirAliveForAtk, log, theirStatus);
    }

    // their turn
    const theirAliveNow = theirCopy.filter(p => p.hp > 0);
    applyDot(theirAliveNow, theirStatus, log);
    const theirHealer = theirAliveNow.find(p => p._weapon && p._weapon.type === 'heal_staff');
    if (theirHealer && theirAliveNow.length > 1) {
      const weakest = theirAliveNow.filter(x => x.id !== theirHealer.id).sort((a, b) => a.hp - b.hp)[0];
      const powerH = 0.6 + (theirHealer._weapon.quality / 100) * 0.8;
      const healAmt = Math.floor(theirHealer.effAtk * (0.3 + powerH * 0.3)) + 5;
      if (weakest.hp > 0) { weakest.hp = Math.min(weakest.max_hp, weakest.hp + healAmt); log.push(`💚 **${theirHealer.species}** heals **${weakest.species}** +${healAmt}`); }
    }
    const theirAliveAfterDot = theirCopy.filter(p => p.hp > 0);
    const myAliveForAtk = myCopy.filter(p => p.hp > 0);
    for (const pet of theirAliveAfterDot) {
      if (!myAliveForAtk.length) break;
      if (pet._weapon && pet._weapon.type === 'great_sword') {
        for (const en of [...myAliveForAtk]) {
          if (en.hp <= 0) continue;
          const dmg = Math.max(0, pet.effAtk - Math.floor(en.effDef / 2) + Math.floor(Math.random() * 10));
          const splashed = Math.floor(dmg * 0.7);
          en.hp = Math.max(0, en.hp - splashed);
          log.push(`⚔️ **${pet.species}** sweeps **${en.species}** for ${splashed} (${en.hp} HP left)`);
          if (en.hp <= 0) log.push(`💀 **${en.species}** fainted!`);
        }
        continue;
      }
      const taunter = myAliveForAtk.find(t => myStatus[t.id] && myStatus[t.id].taunt);
      const t = taunter || myAliveForAtk.reduce((a, b) => a.hp < b.hp ? a : b);
      if (taunter) { myStatus[taunter.id].taunt = false; }
      doDamage(pet, t, 'their', theirAliveAfterDot, myAliveForAtk, log, myStatus);
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
    const reward = Math.floor((50 + myPets.length * 10) * db.eventMult('battleMult'));
    db.payWin(winner.id, reward);
    db.addQuestProgress(winner.id, 'battle', 1);
    db.addBountyProgress(winner.id, 'battle', 1);
    db.addChecklistProgress(winner.id, 'daily', 'battle', 1);
    db.addChecklistProgress(winner.id, 'weekly', 'battle', 1);
    db.addPassXp(winner.id, db.PASS_XP.battle);
    const wins = db.addBattleWin(winner.id);
    const winnerPets = winner.id === message.author.id ? myPets : theirPets;
    for (const pet of winnerPets) {
      db.awardPetAchievement(pet.id, 'battle_first');
      if (wins >= 10) db.awardPetAchievement(pet.id, 'battle_10');
    }
    if (Math.random() < db.WEAPON_BATTLE_DROP_CHANCE) {
      db.addWeaponCrate(winner.id, 1);
      result += ' 🏴‍☠️ **WEAPON CRATE DROP!**';
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
