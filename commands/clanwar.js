const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function clanName(id) {
  const c = id ? db.getClan(id) : null;
  return c ? c.name : 'unknown clan';
}

function warEmbed(w) {
  const fighters = db.getClanWarFighters(w.code);
  const aPow = fighters.attacker.reduce((s, f) => s + f.power, 0);
  const dPow = fighters.defender.reduce((s, f) => s + f.power, 0);
  const atkLines = fighters.attacker.length ? fighters.attacker.map(f => `- <@${f.user_id}> (+${fmtP(f.power)})`).join('\n') : '';
  const defLines = fighters.defender.length ? fighters.defender.map(f => `- <@${f.user_id}> (+${fmtP(f.power)})`).join('\n') : '';
  const fields = [
    ['⚔️ ' + clanName(w.attacker), `${fighters.attacker.length} fighter(s) · total power **${fmtP(aPow)}**\n${atkLines}`],
    ['🛡️ ' + clanName(w.defender), `${fighters.defender.length} fighter(s) · total power **${fmtP(dPow)}**\n${defLines}`],
    ['💰 Stake', `each clan already put in **${fmtP(w.stake)}** ${config.currency} — winner takes **${fmtP(w.stake * 2)}**`],
  ];
  if (w.status === 'challenge') fields.push(['📣', `**${clanName(w.defender)}**, accept to fight! <t:${w.ends_at}:R> left`]);
  if (w.status === 'fighting') fields.push(['⚔️', `fight ends <t:${w.ends_at}:R> — clan members click **Fight** to join the brawl`]);
  return embed('⚔️ Clan War', fields, 0xe74c3c);
}

function fmtP(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function challengeRows(code, defId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`war_a_${code}`).setLabel(`Accept (pay ${fmtP(db.getClanWar(code).stake)})`).setStyle(ButtonStyle.Success).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`war_d_${code}`).setLabel('Decline').setStyle(ButtonStyle.Secondary).setEmoji('❌'),
  );
}

function fightRows(code, atkName, defName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`war_fa_${code}`).setLabel(`Fight for ${atkName.slice(0, 40)}`).setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`war_fd_${code}`).setLabel(`Fight for ${defName.slice(0, 40)}`).setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
  );
}

module.exports = {
  name: 'clanwar',
  helpCategory: 'Social',
  helpArgs: '[challenge <clan name> <stake>]',
  aliases: ['war'],
  description: 'challenge another clan to a treasury war — members click Fight, the winning clan takes both stakes',
  execute(message, args) {
    const userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    const myClanId = db.getClanOf(userId);
    const clan = myClanId ? db.getClan(myClanId) : null;

    if (!sub) {
      const wars = db.getOpenClanWars();
      if (!wars.length) {
        return message.channel.send({ embeds: [embed('⚔️ Clan Wars', [['', 'no wars right now — challenge one with `v clanwar challenge <clan name> <stake>`']])] });
      }
      return message.channel.send({ embeds: wars.map(w => warEmbed(w)) });
    }

    if (sub === 'challenge') {
      if (!clan) return message.channel.send({ embeds: [error('you are not in a clan — `v clan create <name>` or join one first')] });
      const stakeArg = args[args.length - 1];
      const stake = parseInt(stakeArg, 10);
      if (isNaN(stake) || stake <= 0) return message.channel.send({ embeds: [error('usage: `v clanwar challenge <clan name> <stake>`')] });
      const name = args.slice(1, -1).join(' ').trim();
      if (!name) return message.channel.send({ embeds: [error('usage: `v clanwar challenge <clan name> <stake>`')] });
      const defId = db.findClanByName(name);
      const def = defId ? db.getClan(defId) : null;
      if (!def) return message.channel.send({ embeds: [error(`no clan named **${name}** found`) ] });
      const res = db.startClanWar(clan, def, stake, message.channel.id);
      if (!res.ok) {
        const reasons = {
          same: 'you cannot war your own clan', noclan: 'clan not found',
          min: `stake must be at least **${db.CLAN_WAR_MIN.toLocaleString()}** ${config.currency}`,
          max: `stake too big — max **${fmtP(res.maxBet)}** ${config.currency} (25% of the poorer treasury)`,
        };
        return message.channel.send({ embeds: [error(reasons[res.reason] || 'could not start the war')] });
      }
      const w = db.getClanWar(res.code);
      message.channel.send({ embeds: [warEmbed(w)], components: [challengeRows(w.code, def.clan_id)] }).then(msg => {
        db.setClanWarMsg(w.code, msg.id);
      });
      return;
    }

    return message.channel.send({ embeds: [error('usage: `v clanwar challenge <clan name> <stake>`')] });
  },

  async handleInteraction(i) {
    if (!i.customId.startsWith('war_')) return;
    const parts = i.customId.split('_'); // war_a_<code> | war_d_<code> | war_fa_<code> | war_fd_<code>
    const action = parts[1];
    const code = parts[2];
    const userId = i.user.id;
    const mine = action === 'fd' ? 'defender' : action === 'fa' ? 'attacker' : null;

    if (action === 'a' || action === 'd') {
      const myClanId = db.getClanOf(userId);
      const war = db.getClanWar(code);
      if (!war) return i.reply({ embeds: [error('that war is gone')], ephemeral: true });
      if (!myClanId || (action === 'a' && myClanId !== war.defender) || (action === 'd' && myClanId !== war.defender)) {
        return i.reply({ embeds: [error('only members of the challenged clan can accept/decline')], ephemeral: true });
      }
      if (action === 'd') {
        db.declineClanWar(code, myClanId);
        return i.update({ embeds: [embed('⚔️ War Declined', [['', `**${clanName(war.defender)}** declined the challenge from **${clanName(war.attacker)}**`]], 0xe74c3c)], components: [] }).catch(() => {});
      }
      const res = db.acceptClanWar(code, myClanId);
      if (!res.ok) {
        const reasons = { closed: 'that challenge already ended', defender: 'you are not the challenged clan', atkco: 'challenger no longer has the stake — war fell through', defco: `your treasury doesn't have **${fmtP(war.stake)}** for the stake` };
        return i.update({ embeds: [error(reasons[res.reason] || 'could not accept')], components: [] }).catch(() => {});
      }
      const fresh = db.getClanWar(code);
      return i.update({ embeds: [warEmbed(fresh)], components: [fightRows(code, clanName(fresh.attacker), clanName(fresh.defender))] }).catch(() => {});
    }

    if (action === 'fa' || action === 'fd') {
      const myClanId = db.getClanOf(userId);
      const war = db.getClanWar(code);
      if (!war) return i.reply({ embeds: [error('that war is already over')], ephemeral: true });
      const side = action === 'fa' ? war.attacker : war.defender;
      if (!myClanId || myClanId !== side) return i.reply({ embeds: [error('you can only fight for your own clan')], ephemeral: true });
      const res = db.clanWarFight(code, myClanId, userId);
      if (!res.ok) {
        const reasons = { over: 'the war already ended', clan: 'you are not part of this clan', member: 'you are not a member of this clan', joined: 'you already joined this war!' };
        return i.reply({ embeds: [error(reasons[res.reason] || 'could not join')], ephemeral: true });
      }
      await i.reply({ embeds: [success(`⚔️ **${i.member?.displayName || i.user.username}** joins the war for **${clanName(side)}** (+${fmtP(res.power)} power)`)], ephemeral: true }).catch(() => {});
      const fresh = db.getClanWar(code);
      i.message.edit({ embeds: [warEmbed(fresh)], components: [fightRows(code, fresh.attacker ? clanName(fresh.attacker) : '', fresh.defender ? clanName(fresh.defender) : '')] }).catch(() => {});
      return;
    }
  },
};