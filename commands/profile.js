const db = require('../db');
const { embed, error } = require('../utils/embed');
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

    const fields = [
      ['Balance', `**${user.balance.toLocaleString()}** ${config.currency}`],
      ['Level', `Lv.**${li.level}** — ${li.xp.toLocaleString()}/${li.needed.toLocaleString()} xp (${Math.floor(li.progress * 100)}%)`],
      ['Pets', `**${animals}** owned${teamCount ? ` · **${teamCount}** on team` : ''}`],
      ['Total Gambled', `**${user.total_gambled.toLocaleString()}** ${config.currency}`],
      ['Total Won', `**${user.total_won.toLocaleString()}** ${config.currency}`],
      ['Bank', `**${user.bank.toLocaleString()}** ${config.currency}`],
      ['Reputation', `**${user.reputation}** rep`],
      ['Gems & Essence', `**${user.gems}** gems · **${user.essence}** essence`],
      ['Eggs & Seals', `**${eggs}** eggs · **${seals}** seals`],
      ['Battle Wins', `**${battleWins}**`],
      ['Daily Streak', `**${user.daily_streak || 0}** day${user.daily_streak === 1 ? '' : 's'}`],
      ['Lucky', user.lucky ? '🍀 **on** — 90% coinflip wins (3x payout)' : 'off'],
      ['Insurance', ins ? `**${insPct[ins]}%** loss refund` : 'none'],
      ['Free Bet', `**${freeBet.toLocaleString()}** free coins`],
      ['Credit Score', `**${user.credit_score}**`],
    ];

    if (user.loan > 0) fields.push(['Loan', `**${user.loan.toLocaleString()}** outstanding`]);
    if (clan) fields.push(['Clan', `**${clan.name}**`]);
    if (plot) fields.push(['Plot', `Lv.**${plot.level}**`]);
    if (inJail) fields.push(['Jail', `🔒 until <t:${Math.floor(user.jail_until / 1000)}:R>`]);
    fields.push(['Member Since', `<t:${user.created_at}:D>`]);

    if (marriage) {
      const partnerId = marriage.user_id === target.id ? marriage.partner_id : marriage.user_id;
      fields.push(['Married to', `<@${partnerId}>`]);
    }
    if (children.length) {
      fields.push(['Children', children.map(c => `<@${c}>`).join(', ')]);
    }
    if (parents.length) {
      fields.push(['Parents', parents.map(p => `<@${p}>`).join(', ')]);
    }
    if (perks.length) {
      const lines = perks.map(p => {
        if (p.expires_at > 0) {
          const left = Math.max(0, p.expires_at - now);
          const d = Math.floor(left / 86400);
          return `${p.perk} (${d}d left)`;
        }
        return p.perk;
      });
      fields.push(['Perks', lines.join(', ')]);
    }

    message.channel.send({
      embeds: [embed(`${badge}📊 ${target.username}'s Profile`, fields, 0x2b2d31)],
    });
  },
};
