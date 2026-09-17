// Community events expansion test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/events_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/events_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/events_test', { recursive: true });

const db = require('../db');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}

// Start a specific event for testing (clears any active event + cooldown).
function setupEvent(key) {
  db.exec(`DELETE FROM community_events`);
  db.exec(`INSERT OR REPLACE INTO lb_state (key, value) VALUES ('last_community_event', 0)`);
  return db.startCommunityEvent(key);
}

(async () => {
  await db.init();
  for (const id of ['ce_a', 'ce_b', 'ce_bond', 'ce_dex']) db.addBalance(id, 0);

  // --- registry ---
  const KEYS = Object.keys(db.COMMUNITY_EVENTS);
  const ORIGINAL = ['the_button', 'roll_call', 'creature', 'quest_rush', 'double_petxp'];
  const NEW = ['great_hunt', 'gem_rush', 'pet_festival', 'dex_challenge'];
  check('original events preserved', ORIGINAL.every(k => KEYS.includes(k)));
  check('new interactive events added', NEW.every(k => KEYS.includes(k)));
  check('every event defines name/emoji/duration/desc', KEYS.every(k => {
    const e = db.COMMUNITY_EVENTS[k];
    return e.name && e.emoji && e.duration > 0 && e.desc;
  }));

  // --- start / stop lifecycle ---
  const ev = setupEvent('great_hunt');
  check('startCommunityEvent accepts a specific key', !!ev && ev.key === 'great_hunt');
  check('isCommunityEvent recognises the live event', db.isCommunityEvent('great_hunt'));
  check('only one event is active at a time', db.getActiveCommunityEvent().key === 'great_hunt');

  // --- cooperative goal ---
  let p = db.getCommunityProgress('guild1', 'great_hunt', 10);
  check('coop goal has a positive target', p.goal > 0 && p.progress === 0);
  const goal = p.goal;
  let r = db.addCommunityProgress('guild1', 'great_hunt', Math.floor(goal / 2), 'ce_a', 10);
  check('coop progress accumulates', r.progress === Math.floor(goal / 2));
  check('coop counts one contributor', r.contributors === 1);
  check('coop not complete yet', r.done === false);
  check('contributor has no reward before completion', db.getPendingDeliveries('ce_a').length === 0);

  r = db.addCommunityProgress('guild1', 'great_hunt', goal, 'ce_b', 10);
  check('coop caps progress at the goal', r.progress === goal);
  check('coop completes when goal reached', r.done === true && r.rewarded === true);
  check('coop counts both contributors', r.contributors === 2);
  check('each contributor got an inbox reward', db.getPendingDeliveries('ce_a').length === 1 && db.getPendingDeliveries('ce_b').length === 1);

  const again = db.addCommunityProgress('guild1', 'great_hunt', 5, 'ce_a', 10);
  check('completed coop does not re-reward', again.done === true && db.getPendingDeliveries('ce_a').length === 1);

  db.endCommunityEvent('great_hunt');
  check('ending an event clears it', db.getActiveCommunityEvent() === null);
  check('coop progress is a no-op when no event is live', db.addCommunityProgress('guild1', 'great_hunt', 5, 'ce_a', 10) === null);

  // --- pet festival doubles bond ---
  db.exec(`DELETE FROM community_events`);
  const pet = db.addAnimal('ce_bond', 0);
  const shinyMult = pet.shiny ? 2 : 1;
  const base = db.addBond(pet.id, 5);
  check('bond gain is normal with no event', base.gained === 5 * shinyMult);
  setupEvent('pet_festival');
  const fest = db.addBond(pet.id, 5);
  check('pet festival doubles bond gain', fest.gained === 10 * shinyMult);
  db.endCommunityEvent('pet_festival');

  // --- dex challenge pays bonus on a new species ---
  const gemsBefore = db.getGems('ce_dex');
  const balBefore = db.ensureUser('ce_dex').balance;
  setupEvent('dex_challenge');
  db.addAnimal('ce_dex', 0);
  check('dex challenge pays bonus gems', db.getGems('ce_dex') === gemsBefore + 2);
  check('dex challenge pays bonus coins', db.ensureUser('ce_dex').balance === balBefore + 10000);
  db.endCommunityEvent('dex_challenge');
  // no event => no bonus
  const gemsBefore2 = db.getGems('ce_dex');
  db.addAnimal('ce_dex', 0);
  check('no bonus when the event is over', db.getGems('ce_dex') === gemsBefore2);

  // --- v event command smoke (coop + normal) ---
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'discord.js') {
      return { EmbedBuilder: class { setColor() { return this; } setTitle() { return this; } addFields() { return this; } setDescription(t) { this.description = t; return this; } } };
    }
    return origLoad.apply(this, arguments);
  };
  const eventCmd = require('../commands/event');
  const fakeMsg = {
    author: { id: 'ce_a', username: 'Tester' },
    guild: { id: 'guild1', memberCount: 10 },
    channel: { send: async (p) => { fakeMsg.sent = p; return {}; } },
  };
  setupEvent('great_hunt');
  fakeMsg.sent = null; await eventCmd.execute(fakeMsg, []);
  check('v event shows a coop event embed', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds) && fakeMsg.sent.embeds.length === 1);
  db.endCommunityEvent('great_hunt');
  setupEvent('gem_rush');
  fakeMsg.sent = null; await eventCmd.execute(fakeMsg, []);
  check('v event shows a normal event embed', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds));
  db.endCommunityEvent('gem_rush');
  fakeMsg.sent = null; await eventCmd.execute(fakeMsg, []);
  check('v event handles no active event', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds));
  Module._load = origLoad;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
