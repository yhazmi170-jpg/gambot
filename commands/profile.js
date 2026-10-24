const db = require('../db');
const { card, error, progressBar } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'profile',
  helpCategory: 'Social',
  helpArgs: '[@user]',
  description: 'detailed stats card',
  aliases: ['stats', 'me'],
  execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    const user = db.ensureUser(target.id);
    if (!user) return message.channel.send({ embeds: [error('user not found')] });

    const marriage = db.getMarriage(target.id);
    const children = db.getChildren(target.id);
    const parents = db.getParents(target.id);
    const perks = db.getUserPerks(target.id);
    const now = Math.floor(Date.now() / 1000);
    const badge = db.hasPerk(target.id, 'badge') ? db.getBadgeEmoji(target.id) + ' ' : '';

    const li = db.levelInfo(target.id);
    const animals = db.getAnimalCount(target.id);
    const team = db.getTeam(target.id);
    const teamCount = team ? [team.slot1, team.slot2, team.slot3].filter(Boolean).length : 0;
    const eggs = db.getEggs(target.id);
    const seals = db.getSeals(target.id);
    const battleWins = db.getBattleWins(target.id);
    const freeBet = db.getFreeBet(target.id);
    const plot = db.getPlot(target.id);
    const clanId = db.getClanOf(target.id);
    const clan = clanId ? db.getClan(clanId) : null;
    const ins = ['insurance4', 'insurance3', 'insurance2', 'insurance'].find(p => db.hasPerk(target.id, p));
    const insPct = { insurance: 10, insurance2: 15, insurance3: 20, insurance4: 25 };
    const inJail = user.jail_until > Date.now();

    const titleLine = (uid) => {
      const eq = db.getEquippedTitle(uid);
      const count = db.getTitles(uid).length;
      if (eq && db.TITLES[eq]) return `**${db.TITLES[eq].name}** (${count} owned)`;
      return count > 0 ? `${count} owned` : 'None';
    };

    const avatarUrl = user.avatar_url || (target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true, size: 256 }) : null);

    const fields = [
      ['Level & Progression', `**Level ${li.level}**\n${progressBar(li.xp, li.needed, 8)} \`${Math.floor(li.progress * 100)}%\` (${li.xp.toLocaleString()}/${li.needed.toLocaleString()} XP)`, false],
      ['💰 Balance', `**${user.balance.toLocaleString()}** ${config.currency}`, true],
      ['🏦 Bank Vault', `**${user.bank.toLocaleString()}** ${config.currency}`, true],
      ['💎 Gems & Essence', `**${user.gems}** 💎 • **${user.essence}** ✨`, true],
      ['🐾 Animals & Team', `**${animals}** owned${teamCount ? ` • **${teamCount}** team` : ''}`, true],
      ['🏆 Battle Wins', `**${battleWins}** wins`, true],
      ['🔥 Daily Streak', `**${user.daily_streak || 0}** days`, true],
      ['🎲 Total Gambled', `**${user.total_gambled.toLocaleString()}** ${config.currency}`, true],
      ['📈 Total Won', `**${user.total_won.toLocaleString()}** ${config.currency}`, true],
      ['🛡️ Insurance', ins ? `**${insPct[ins]}%** refund` : 'None', true],
      ['🎖️ Title', titleLine(target.id), true],
      ['⭐ Reputation', `**${user.reputation}** rep`, true],
      ['💳 Credit Score', `**${user.credit_score}**`, true],
    ];

    if (eggs || seals) fields.push(['🥚 Eggs & Seals', `**${eggs}** eggs • **${seals}** seals`, true]);
    if (freeBet > 0) fields.push(['🎁 Free Bet', `**${freeBet.toLocaleString()}** coins`, true]);
    if (user.loan > 0) fields.push(['⚠️ Loan', `**${user.loan.toLocaleString()}** outstanding`, true]);
    if (clan) fields.push(['🛡️ Clan', `**${clan.name}**`, true]);
    if (plot) fields.push(['🏡 Plot', `Lv.**${plot.level}**`, true]);
    if (inJail) fields.push(['🔒 Jail', `Until <t:${Math.floor(user.jail_until / 1000)}:R>`, true]);

    if (marriage) {
      const partnerId = marriage.user_id === target.id ? marriage.partner_id : marriage.user_id;
      fields.push(['💍 Married to', `<@${partnerId}>`, true]);
    }
    if (children.length) {
      fields.push(['👶 Children', children.map(c => `<@${c}>`).join(', '), true]);
    }
    if (parents.length) {
      fields.push(['👪 Parents', parents.map(p => `<@${p}>`).join(', '), true]);
    }
    if (perks.length) {
      const lines = perks.map(p => {
        if (p.expires_at > 0) {
          const left = Math.max(0, p.expires_at - now);
          const d = Math.floor(left / 86400);
          return `${p.perk} (${d}d)`;
        }
        return p.perk;
      });
      fields.push(['⚡ Active Perks', lines.join(', '), false]);
    }

    const e = card({
      author: { name: `${badge}${target.username}'s Adventure Profile`, iconURL: avatarUrl },
      thumbnail: avatarUrl,
      fields,
      color: 0x5865f2,
      footer: `Gambot RPG • Account created`,
      timestamp: new Date(user.created_at * 1000),
    });
    if (user.banner_url) e.setImage(user.banner_url);
    message.channel.send({ embeds: [e] });
  },
};
