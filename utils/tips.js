// Verified mechanic tips. Every number here is checked against db/index.js constants.
// Do not invent caps — re-derive from source when they change.

const db = require('../db');

const TIPS = [
  `hunting costs ${db.HUNT_COST_BASE || 5} coins per animal and your cap is gems/5 (max ${db.MAX_HUNT_CAP || 10}). more gems = bigger nets, no extra cost per animal.`,
  `eggs drop about 8% per animal hunted. the egg_luck shop perk doubles that. unhatched eggs do nothing — run v hatch.`,
  `your autohunt bot costs ${db.AUTOHUNT_COST_PER_MIN || 50} coins/min and pausing is free — it catches up missed cycles on your next command.`,
  `a weapon crate is ${(db.WEAPON_CRATE_PRICE || 15000).toLocaleString()} coins, but crates can also drop from hunting and battle wins. equip weapons only on team animals (v weapon equip).`,
  `insurance tiers refill a flat % of losses (10 → 15 → 20 → 25%). the highest owned tier wins automatically.`,
  `the bigger your balance, the softer your gambling payouts: −1% per 500k, floor at 40%. daily/weekly/work scale too, but PvP transfers (give/duel/rob) never get cut.`,
  `trait essence costs go up fast: floor(20 × (level+1)^1.5). level 1 is cheap, the curve hurts after that.`,
  `a created clan costs ${(db.CLAN_CREATE_COST || 5000000).toLocaleString()} coins and is tied to you, not a server — anyone can join from anywhere.`,
  `rain events boost work income and daily quests stay payable once a day. streak resets after 48h idle — miss a day and you lose the chain.`,
  `the merchant visits roughly every 90 min with 3 one-time stock slots — the rare pet grab-bag is usually the value pick.`,
  `checklist claims award coins AND seals. seals are the battle-pass currency — buy premium with 25 seals, then claim every tier.`,
  `quests auto-capture active progress (hunt/sacrifice/work/give/battle) — no manual tracking needed, just visit v quest daily.`,
  `bounties are weekly and share progress hooks with quests. stacking a bounty + quest on the same action double-dips their reward tracks.`,
  `v vault deposit is per-guild and only you can withdraw what you put in — use it to park coins away from impulse gambling.`,
  `crate pity rises with every opened crate that isnt mythic — check v crate. holding onto coins for one big crate spree beats spending as you go.`,
  `sell whole species/rarities with v sell <species|rarity> to clear zoo clutter in one command; team animals are always skipped.`,
  `sacrificing is the essence source: common 1 / uncommon 3 / rare 8 / epic 25 / legendary 100 per animal. never sacrifice your battle team by accident.`,
  `the snail garden failure chance starts at 20% and climbs 7% per step, max 95% — cash out mid-run instead of pushing a row.`,
  `loan repayments are auto-taken from winnings, so a shark loan is a last-resort lever, not a strategy.`,
  `free bets and streak logins are claim-only signals — they keep your daily baseline going even on low-activity days.`,
  `every command grants 25 xp (with a cap between commands). grinding low-effort commands is still grinding.`,
  `hatch eggs with v hatch — the hatched counter feeds titles and achievements, so never let eggs pile up silently.`,
];

const SEEN = new Map();

/** Picks a passive tip for a channel, avoiding immediate repeats. */
function pickPassiveTip() {
  if (!TIPS.length) return null;
  let pick = TIPS[Math.floor(Math.random() * TIPS.length)];
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const last = SEEN.get(TIPS.indexOf(pick)) || 0;
    if (now - last > 1800000) break;
    pick = TIPS[Math.floor(Math.random() * TIPS.length)];
  }
  SEEN.set(TIPS.indexOf(pick), now);
  return pick;
}

module.exports = { TIPS, pickPassiveTip };