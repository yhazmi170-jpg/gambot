// Social mention presentation test. NEVER touches production — DB_PATH is a temp file.
process.env.DB_PATH = '/tmp/social_test/gambot.db';
const fs = require('fs');
fs.rmSync('/tmp/social_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/social_test', { recursive: true });

// Stub the embed builder so social.js can be required without a real Discord client.
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'discord.js') {
    return {
      EmbedBuilder: class {
        setColor() { return this; }
        setTitle(t) { this.title = t; return this; }
        addFields() { return this; }
        setDescription(t) { this.description = t; return this; }
        setImage(u) { this.image = u; return this; }
      },
    };
  }
  return origLoad.apply(this, arguments);
};

const db = require('../db');
const { execSocial } = require('../utils/social');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}

function fakeMessage(selfId, targetId) {
  const target = targetId ? { id: targetId } : null;
  return {
    author: { id: selfId },
    mentions: { users: { first: () => target } },
    react: async (e) => { m.reacted = e; },
    channel: { send: async (payload) => { m.sent = payload; return {}; } },
  };
}
let m;

(async () => {
  await db.init();
  db.addBalance('soc_actor', 0);

  // --- targeted mention goes through message content, not an embed title ---
  m = fakeMessage('soc_actor', 'soc_target');
  await execSocial(m, 'hug');
  check('targeted social sends message content', typeof m.sent.content === 'string' && m.sent.content.length > 0);
  check('action line contains a real actor mention', m.sent.content.includes('<@soc_actor>'));
  check('action line contains a real target mention', m.sent.content.includes('<@soc_target>'));
  check('no literal mention is forced into an embed title', !(m.sent.embeds[0].title || '').includes('<@'));
  check('no literal mention is forced into an embed description', !(m.sent.embeds[0].description || '').includes('<@'));
  check('gif is attached as an embed image', !!m.sent.embeds[0].image && /^https?:\/\//.test(m.sent.embeds[0].image));
  check('allowedMentions pings only the target', JSON.stringify(m.sent.allowedMentions.users) === JSON.stringify(['soc_target']));
  check('allowedMentions never parses @everyone/@here/roles', JSON.stringify(m.sent.allowedMentions.parse) === JSON.stringify([]));
  check('actor is not pinged', !m.sent.allowedMentions.users.includes('soc_actor'));
  check('the actor self-reacts', m.reacted === '🤗');

  // --- self action: no ping at all ---
  m = fakeMessage('soc_actor', null);
  await execSocial(m, 'pat');
  check('self social still shows a real mention', m.sent.content.includes('<@soc_actor>'));
  check('self social pings nobody', JSON.stringify(m.sent.allowedMentions.parse) === JSON.stringify([]) && !m.sent.allowedMentions.users);
  check('self social still attaches a gif', !!m.sent.embeds[0].image);

  // --- interaction-pair milestones (1st, then 10/25/... only) ---
  m = fakeMessage('soc_pair', 'soc_partner');
  await execSocial(m, 'hug');
  check('first interaction says "for the 1st time!"', /for the 1st time!/.test(m.sent.content));
  check('pair count starts at 1', db.getSocialPair('soc_pair', 'soc_partner', 'hug').count === 1);

  m = fakeMessage('soc_pair', 'soc_partner');
  await execSocial(m, 'hug');
  check('2nd interaction shows no count', !/for the/.test(m.sent.content));

  for (let i = 3; i <= 9; i++) { m = fakeMessage('soc_pair', 'soc_partner'); await execSocial(m, 'hug'); }
  m = fakeMessage('soc_pair', 'soc_partner');
  await execSocial(m, 'hug');
  check('10th interaction is a milestone', /for the 10th time!/.test(m.sent.content));
  check('pair count reaches 10', db.getSocialPair('soc_pair', 'soc_partner', 'hug').count === 10);
  check('non-milestone counts are not stored as milestones', !/(11th|12th)/.test(m.sent.content));

  // different action is a separate pair
  m = fakeMessage('soc_pair', 'soc_partner');
  await execSocial(m, 'pat');
  check('action separation keeps its own pair', /for the 1st time!/.test(m.sent.content) && db.getSocialPair('soc_pair', 'soc_partner', 'pat').count === 1);

  // self actions must not create a pair
  m = fakeMessage('soc_pair', null);
  await execSocial(m, 'hug');
  check('self actions create no pair', db.getSocialPair('soc_pair', 'soc_pair', 'hug') === null);

  // --- every social action produces the same safe shape ---
  const actions = ['hug', 'kiss', 'kill', 'slap', 'pat', 'cuddle', 'bite', 'punch', 'lick'];
  let ok = true;
  for (const a of actions) {
    m = fakeMessage('soc_actor', 'soc_target');
    await execSocial(m, a);
    if (!m.sent || !m.sent.content || !m.sent.embeds[0].image) ok = false;
  }
  check('all 9 social actions send content + gif', ok);

  Module._load = origLoad;
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
