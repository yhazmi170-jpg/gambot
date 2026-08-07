const db = require('../db');
const { embed, error } = require('../utils/embed');
const config = require('../config');

const RARITY_EMOJIS = { common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟨', mythic: '👑' };

module.exports = {
  name: 'raid',
  helpCategory: 'Social',
  helpArgs: '[stake]',
  description: 'fight the server boss with your team — top damage splits the pot',
  aliases: ['boss'],
  execute(message, args) {
    const userId = message.author.id;
    const guildId = message.guild ? message.guild.id : 'global';
    let boss = db.getBoss(guildId);
    if (!boss) {
      const count = message.guild ? message.guild.memberCount : 5;
      boss = db.spawnBoss(guildId, count || 5);
      message.channel.send({ embeds: [embed(`⚔️ A wild ${RARITY_EMOJIS[boss.rarity]} **${boss.species}** appeared!`, [
        ['HP', `**${boss.max_hp.toLocaleString()}** total`],
        ['Level', boss.level],
        ['Next', 'everyone attack with `v raid <stake>` — the pot is split by damage when it dies'],
      ], 0xed4245)] });
    }
    const stake = args[0] ? parseInt(args[0], 10) : 1000;
    if (!stake || stake <= 0) return message.channel.send({ embeds: [error('give a stake amount, e.g. `v raid 5000`')] });

    const team = db.getTeam(userId);
    const pets = team ? [team.slot1, team.slot2, team.slot3].filter(Boolean).map(id => db.getAnimal(id)).filter(Boolean) : [];
    if (!pets.length) return message.channel.send({ embeds: [error('your battle team is empty — `v team add` some pets first')] });

    const power = pets.reduce((s, p) => s + (p.attack || 0) + Math.floor((p.max_hp || 0) / 10), 0);
    const dmg = Math.max(1, Math.floor(power * (0.7 + Math.random() * 0.6)));

    const u = db.ensureUser(userId);
    if ((u.balance || 0) < stake) return message.channel.send({ embeds: [error('not enough coins for that stake')] });
    db.addBalance(userId, -stake);
    db.addBossPot(guildId, stake);
    const atk = db.attackBoss(guildId, userId, dmg);
    if (!atk.ok) return message.channel.send({ embeds: [error('the boss disappeared mid-fight — try again')] });

    const dead = atk.hp <= 0;
    if (dead) {
      const res = db.resolveBoss(guildId);
      const lines = (res && res.payouts ? res.payouts : []).slice(0, 10).map((p, i) => `${i + 1}. <@${p.user_id}> — **${p.share.toLocaleString()}** ${config.currency} (${p.damage.toLocaleString()} dmg)`).join('\n');
      return message.channel.send({ embeds: [embed(`💀 **${boss.species}** has been slain!`, [
        ['Your hit', `**${dmg.toLocaleString()}** damage for **${stake.toLocaleString()}** stake`],
        ['Pot split', lines || 'nobody contributed'],
      ], 0x57f287)] });
    }

    const contrib = db.getBossContrib(guildId);
    const myRank = contrib.findIndex(c => c.user_id === userId) + 1;
    return message.channel.send({ embeds: [embed(`⚔️ ${boss.species} raid`, [
      ['HP', `${'█'.repeat(Math.max(1, Math.ceil((atk.hp / atk.max_hp) * 10)))}${'░'.repeat(Math.max(0, 10 - Math.ceil((atk.hp / atk.max_hp) * 10)))} **${atk.hp.toLocaleString()}/${atk.max_hp.toLocaleString()}**`],
      ['Your hit', `**${dmg.toLocaleString()}** damage · stake **${stake.toLocaleString()}**`],
      ['Rank', myRank ? `**#${myRank}** of ${contrib.length} contributors` : 'not ranked'],
      ['Pot', `**${(boss.pot + stake).toLocaleString()}** ${config.currency}`],
      ['Next', 'keep hitting `v raid <stake>` with the server — top damage splits the pot'],
    ], 0x5865f2)] });
  },
};