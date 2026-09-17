// Incidents / server-lore test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/incidents_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/incidents_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/incidents_test', { recursive: true });

const db = require('../db');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}
function countIncidents(guildId) {
  const rows = db.exec(`SELECT COUNT(*) FROM incidents WHERE guild_id = '${guildId}'`);
  return rows.length ? rows[0].values[0][0] : 0;
}

(async () => {
  await db.init();

  // --- basic roundtrip ---
  db.addIncident('g1', 'event', 'something notable happened');
  const list = db.getIncidents('g1', 5);
  check('addIncident + getIncidents roundtrip', list.length === 1 && list[0].text === 'something notable happened');
  check('incident keeps its type', list[0].type === 'event');
  check('incident does not store message content', !/message|content/i.test(list[0].text));

  // --- selective discovery lore ---
  check('common finds are not lore', db.recordDiscoveries('g1', 'u1', [{ species: 'Rabbit', rarity: 'common', shiny: false }]) === false);
  check('epic finds are not lore', db.recordDiscoveries('g1', 'u1', [{ species: 'Golem', rarity: 'epic', shiny: false }]) === false);
  const before = countIncidents('g1');
  db.recordDiscoveries('g1', 'u1', [{ species: 'Phoenix', rarity: 'legendary', shiny: false }]);
  check('legendary finds are lore', countIncidents('g1') === before + 1);
  db.recordDiscoveries('g1', 'u2', [{ species: 'Worldeater', rarity: 'mythic', shiny: false }]);
  check('mythic finds are lore', countIncidents('g1') === before + 2);
  db.recordDiscoveries('g1', 'u3', [{ species: 'Rabbit', rarity: 'common', shiny: true }]);
  check('shiny finds are lore', countIncidents('g1') === before + 3);

  const b2 = countIncidents('g1');
  db.recordDiscoveries('g1', 'u4', [
    { species: 'Golem', rarity: 'epic', shiny: false },
    { species: 'Phoenix', rarity: 'legendary', shiny: false },
  ]);
  check('a batch records at most one discovery', countIncidents('g1') === b2 + 1);
  const latest = db.getIncidents('g1', 1)[0];
  check('the best find in the batch is recorded', /legendary/.test(latest.text));
  check('no guild => no lore', db.recordDiscoveries(null, 'u1', [{ species: 'Phoenix', rarity: 'legendary' }]) === false);

  // --- category retention: only notable lore, capped per guild ---
  for (let i = 0; i < 70; i++) db.addIncident('g2', 'milestone', `progression milestone ${i}`);
  check('lore is capped per guild', countIncidents('g2') === db.INCIDENT_LIMIT_PER_GUILD);
  check('getIncidents respects the limit', db.getIncidents('g2', 100).length === 30);

  // --- community-event completion writes lore ---
  db.exec(`DELETE FROM community_events`);
  db.exec(`INSERT OR REPLACE INTO lb_state (key, value) VALUES ('last_community_event', 0)`);
  db.startCommunityEvent('great_hunt');
  const evBefore = countIncidents('g3');
  const goal = db.getCommunityProgress('g3', 'great_hunt', 10).goal;
  db.addCommunityProgress('g3', 'great_hunt', goal, 'u1', 10);
  const evList = db.getIncidents('g3', 5);
  check('coop completion writes an event lore entry', countIncidents('g3') === evBefore + 1 && evList[0].type === 'event');
  check('coop lore names the event', /Great Hunt/.test(evList[0].text));
  db.endCommunityEvent('great_hunt');

  // --- v incidents command smoke ---
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'discord.js') {
      return { EmbedBuilder: class { setColor() { return this; } setTitle() { return this; } addFields() { return this; } setDescription(t) { this.description = t; return this; } } };
    }
    return origLoad.apply(this, arguments);
  };
  const cmd = require('../commands/incidents');
  const fakeMsg = { author: { id: 'u1' }, guild: { id: 'g1' }, channel: { send: async (p) => { fakeMsg.sent = p; return {}; } } };
  await cmd.execute(fakeMsg, []);
  check('v lore sends an embed', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds) && fakeMsg.sent.embeds.length === 1);
  fakeMsg.sent = null; await cmd.execute({ author: { id: 'u1' }, guild: null, channel: { send: async (p) => { fakeMsg.sent = p; return {}; } } }, []);
  check('v lore rejects DMs', !!fakeMsg.sent && Array.isArray(fakeMsg.sent.embeds));
  Module._load = origLoad;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
