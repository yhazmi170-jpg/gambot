const db = require('../db');

/** Gather harmless real Gambot stats for a player (used by case/judge/compare). */
function collectStats(userId) {
  const u = db.ensureUser(userId) || {};
  const li = db.levelInfo(userId);
  const owned = db.getOwnedSpecies(userId) || {};
  const speciesCount = Object.values(owned).reduce((n, list) => n + (list ? list.length : 0), 0);
  const titles = db.getTitles(userId) || [];
  const activity = db.getActivity(userId) || {};
  const clanName = (() => {
    try {
      const clanId = db.getClanOf(userId);
      if (!clanId) return '';
      const clan = db.getClan(clanId);
      return clan && clan.name ? clan.name : '';
    } catch { return ''; }
  })();

  return {
    userId,
    level: li.level || 1,
    xp: li.xp || 0,
    balance: u.balance || 0,
    bank: u.bank || 0,
    animals: db.getAnimalCount(userId),
    speciesCount,
    speciesTotal: Object.values(db.SPECIES).reduce((n, list) => n + list.length, 0),
    eggs: u.eggs || 0,
    hatched: u.hatched || 0,
    gems: u.gems || 0,
    essence: u.essence || 0,
    seals: u.seals || 0,
    battleWins: u.battles_won || 0,
    social: u.social_used || 0,
    worked: u.worked || 0,
    shinyFound: u.shiny_found || 0,
    questsDone: u.quests_done || 0,
    moneySent: u.money_sent || 0,
    titlesOwned: titles.length,
    titlesTotal: Object.keys(db.TITLES).length,
    married: !!db.getMarriage(userId),
    children: (db.getChildren(userId) || []).length,
    clanName,
    rep: u.reputation || 0,
    judged: u.judged || 0,
    firstSeen: activity.first_seen || 0,
    lastMeaningful: activity.last_meaningful_at || 0,
  };
}

module.exports = { collectStats };