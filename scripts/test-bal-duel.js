// Regression: `v bal` views (self / owner audit) + the 100M duel stake cap.
//  - self view shows Money, Bank and Inbox (unclaimed)
//  - `v bal @user` is OWNER-ONLY and shows that player's bank + pending inbox
//  - members mentioning anyone else are rejected
//  - `v duel` refuses anything above 100,000,000, accepts exactly 100M
process.env.DB_PATH = '/tmp/bal_duel_test';
const fs = require('fs');
fs.rmSync('/tmp/bal_duel_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/bal_duel_test', { recursive: true });

let pass = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
}

const db = require('../db');
const config = require('../config');
const balCmd = require('../commands/bal');
const duelCmd = require('../commands/duel');

function makeMsg(userId, opts = {}) {
  const m = {
    id: 'm_' + Math.random().toString(36).slice(2),
    author: { id: userId, bot: false, username: opts.username || 'tester' },
    guild: { id: 'guild_bd' },
    channel: {
      id: 'chan_bd', type: 0,
      send: async (payload) => {
        m._sent = payload;
        return { id: 'sent_' + m.id, edit: async () => {}, createMessageComponentCollector: () => ({ on() {} }) };
      },
    },
    mentions: { users: { first: () => opts.mention || null } },
    content: '',
    react: async () => {},
  };
  return m;
}

const embedOf = (m) => (m._sent && m._sent.embeds && m._sent.embeds[0]) || null;
const titleOf = (m) => { const e = embedOf(m); return e && (e.data ? e.data.title : e.title); };
const fieldsOf = (m) => { const e = embedOf(m); return (e && e.data && e.data.fields) || []; };
const fieldVal = (m, name) => { const f = fieldsOf(m).find(x => x.name === name); return f ? f.value : undefined; };
const allText = (m) => fieldsOf(m).map(f => `${f.name}: ${f.value}`).join(' | ');

(async () => {
  await db.init();

  // ---- fixture players ----
  const me = 'bd_member';
  const friend = 'bd_friend';
  const boss = config.ownerId;
  db.addBalance(me, 1000);
  db.exec(`UPDATE users SET bank = 500 WHERE user_id = '${me}'`);
  db.createDelivery(me, { sender: 'bd_whoever', source: 'giveaway', amount: 123456, label: 'test prize', payload: { gw: 'bd1' } });

  // ---- 1. self view: money + bank + inbox ----
  let m = makeMsg(me);
  balCmd.execute(m, []);
  check('self view renders', titleOf(m) === '💰 Balance', `title=${titleOf(m)}`);
  check('self view shows wallet', (fieldVal(m, 'Money') || '').includes('1,000'), allText(m));
  check('self view shows bank', (fieldVal(m, 'Bank') || '').includes('500'), allText(m));
  check('self view shows unclaimed inbox', (fieldVal(m, 'Inbox (unclaimed)') || '').includes('123,456'), allText(m));

  // ---- 2. member mentioning someone else is rejected ----
  m = makeMsg(me, { mention: { id: friend, bot: false, username: 'friend' } });
  balCmd.execute(m, ['<@friend>']);
  check('non-owner mention rejected', titleOf(m) === 'Error' && (fieldVal(m, 'message') || '').includes('your own balance'), allText(m));

  // ---- 3. owner mention = full audit (bank + pending inbox of the target) ----
  db.addBalance(friend, 777);
  db.exec(`UPDATE users SET bank = 888 WHERE user_id = '${friend}'`);
  db.createDelivery(friend, { sender: 'bd_giver', source: 'give', amount: 424242, label: 'gift', payload: {} });
  m = makeMsg(boss, { mention: { id: friend, bot: false, username: 'friend' } });
  balCmd.execute(m, ['<@friend>']);
  check('owner audit renders', titleOf(m) === '💰 Balance', `title=${titleOf(m)}`);
  check('owner audit shows target wallet', (fieldVal(m, 'Money') || '').includes('777'), allText(m));
  check('owner audit shows target bank', (fieldVal(m, 'Bank') || '').includes('888'), allText(m));
  check('owner audit shows target pending inbox', (fieldVal(m, 'Inbox (unclaimed)') || '').includes('424,242'), allText(m));

  // ---- 4. bot mention ----
  m = makeMsg(me, { mention: { id: '123456789012345678', bot: true, username: 'somerobot' } });
  balCmd.execute(m, ['<@bot>']);
  check('bot mention rejected', titleOf(m) === 'Error' && (fieldVal(m, 'message') || '').includes('bots have no balance'), allText(m));

  // ---- 5. duel cap ----
  const challenger = 'bd_dueler';
  const opponent = 'bd_victim';
  db.addBalance(challenger, 1000000000);
  db.addBalance(opponent, 1000000000);
  const mention = { id: opponent, bot: false, username: 'victim' };

  // no perk -> blocked before any money talk
  m = makeMsg(challenger, { mention });
  duelCmd.execute(m, ['<@victim>', '10000']);
  check('duel requires the perk', titleOf(m) === 'Error' && (fieldVal(m, 'message') || '').includes('duel perk'), allText(m));

  db.addPerk(challenger, 'duel', 0);

  // over the cap
  m = makeMsg(challenger, { mention });
  duelCmd.execute(m, ['<@victim>', '300m']);
  check('duel 300m rejected by cap', titleOf(m) === 'Error' && (fieldVal(m, 'message') || '').includes('100,000,000'), allText(m));

  m = makeMsg(challenger, { mention });
  duelCmd.execute(m, ['<@victim>', '100000001']);
  check('duel 100,000,001 rejected by cap', titleOf(m) === 'Error' && (fieldVal(m, 'message') || '').includes('100,000,000'), allText(m));

  // exactly at / just under the cap -> challenge goes out
  m = makeMsg(challenger, { mention });
  duelCmd.execute(m, ['<@victim>', '100m']);
  check('duel exactly 100M allowed', titleOf(m) === '⚔️ Duel Challenge', `title=${titleOf(m)} ${allText(m)}`);

  m = makeMsg(challenger, { mention });
  duelCmd.execute(m, ['<@victim>', '99999999']);
  check('duel 99,999,999 allowed', titleOf(m) === '⚔️ Duel Challenge', `title=${titleOf(m)} ${allText(m)}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
