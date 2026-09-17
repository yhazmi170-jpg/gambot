// NEVER touches production balances — DB_PATH redirected to a temp dir.
process.env.DB_PATH = '/tmp/gw_test';
const fs = require('fs');
fs.rmSync('/tmp/gw_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/gw_test', { recursive: true });

const db = require('../db');
const giveaway = require('../utils/giveaway');

let pass = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
}

async function main() {
  await db.init();

  // --- schema migration: winner_count + mode columns exist ---
  const cols = db.exec('PRAGMA table_info(giveaways)')[0].values.map(v => v[1]);
  check('giveaways has winner_count column', cols.includes('winner_count'));
  check('giveaways has mode column', cols.includes('mode'));

  // --- createGiveaway persists winners + mode ---
  db.createGiveaway('msg1', 'chan1', 'host1', 100, Math.floor(Date.now() / 1000) + 3600, 10, 'split');
  const g = db.getGiveaway('msg1');
  check('winner_count persisted (10)', g.winner_count === 10, `got ${g.winner_count}`);
  check('mode persisted (split)', g.mode === 'split', `got ${g.mode}`);

  db.createGiveaway('msg2', 'chan1', 'host1', 100, Math.floor(Date.now() / 1000) + 3600, 3, 'full');
  const g2 = db.getGiveaway('msg2');
  check('full mode winner_count persisted (3)', g2.winner_count === 3 && g2.mode === 'full');

  // --- default createGiveaway (legacy signature) still works ---
  db.createGiveaway('msg3', 'chan1', 'host1', 50, Math.floor(Date.now() / 1000) + 3600);
  const g3 = db.getGiveaway('msg3');
  check('legacy default winner_count 1, mode split', g3.winner_count === 1 && g3.mode === 'split');

  // --- split math (real module) ---
  let r = giveaway.computePayout(100, 10, 'split', 3);
  check('split: 100 across 3 = 33 each', r.perWinner === 33, JSON.stringify(r));
  check('split: remainder 1 refunded to host', r.refund === 1, JSON.stringify(r));
  check('split: mode normalized', r.mode === 'split');

  // --- full math with underfill refund (real module) ---
  r = giveaway.computePayout(100, 10, 'full', 3);
  check('full: each winner gets full 100', r.perWinner === 100, JSON.stringify(r));
  check('full: underfill refunds 700 to host', r.refund === 700, JSON.stringify(r));

  // --- full with all slots filled => no refund ---
  r = giveaway.computePayout(100, 10, 'full', 10);
  check('full: no refund when every slot wins', r.refund === 0, JSON.stringify(r));

  // --- split distributes the whole pot (no remainder) ---
  r = giveaway.computePayout(90, 10, 'split', 3);
  check('split: exact division => no refund', r.perWinner === 30 && r.refund === 0, JSON.stringify(r));

  // --- unknown mode falls back to split ---
  r = giveaway.computePayout(90, 3, 'bogus', 3);
  check('unknown mode => split', r.mode === 'split' && r.perWinner === 30, JSON.stringify(r));

  // --- giveaway source is a valid inbox source + deliverable ---
  check('giveaway in INBOX_SOURCES', db.INBOX_SOURCES.includes('giveaway'));
  const dId = db.createDelivery('u1', { sender: 'host1', source: 'giveaway', label: 'giveaway prize (1 of 3)', amount: 33 });
  check('createDelivery returns id', Number.isFinite(dId), `got ${dId}`);
  const pending = db.getPendingDeliveries('u1');
  check('delivery is pending in inbox', pending.length === 1 && pending[0].amount === 33, JSON.stringify(pending));
  check('delivery source is giveaway', pending[0].source === 'giveaway', `got ${pending[0].source}`);

  // claim moves money + marks claimed
  const before = db.getBalance('u1');
  const res = db.claimAllDeliveries('u1');
  const after = db.getBalance('u1');
  check('claim credited 33', after - before === 33, `before ${before} after ${after}`);
  check('claim reports 1 delivery', res.count === 1 && res.credited === 33, JSON.stringify(res));
  check('inbox empty after claim', db.getPendingDeliveries('u1').length === 0);

  // --- multi-winner uniqueness + deterministic draw via injected RNG ---
  const drawn = giveaway.drawWinners(['a', 'b', 'c', 'd', 'e'], 5, Math.random);
  check('draws unique winners', new Set(drawn).size === drawn.length && drawn.length === 5, JSON.stringify(drawn));

  // deterministic: rng always 0 -> picks first of the shrinking pool, in order
  const det = giveaway.drawWinners(['a', 'b', 'c', 'd'], 3, () => 0);
  check('deterministic draw with rng=0', JSON.stringify(det) === JSON.stringify(['a', 'b', 'c']), JSON.stringify(det));

  // underfilled: 10 requested but only 2 entries -> 2 winners
  const under = giveaway.drawWinners(['x', 'y'], 10, () => 0);
  check('underfilled draw caps at entry count', under.length === 2, JSON.stringify(under));

  // never draws more unique winners than entries
  const many = giveaway.drawWinners(['a', 'a', 'b'], 3, Math.random);
  check('draw length <= entries', many.length === 3);

  // --- finishGiveaway accepts an array and expired are found ---
  db.finishGiveaway('msg1', ['u1', 'u2', 'u3']);
  const expired = db.getExpiredGiveaways(Math.floor(Date.now() / 1000) + 999999999);
  check('finished giveaway no longer expired', !expired.includes('msg1'));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
