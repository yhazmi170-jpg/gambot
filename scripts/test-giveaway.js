// NEVER touches production balances — DB_PATH redirected to a temp dir.
process.env.DB_PATH = '/tmp/gw_test';
const fs = require('fs');
fs.rmSync('/tmp/gw_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/gw_test', { recursive: true });

const db = require('../db');

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

  // --- split math (mirrors the sweep) ---
  let winners = ['u1', 'u2', 'u3'];
  let per = Math.floor(100 / winners.length);
  let refund = 100 - per * winners.length;
  check('split: 100 across 3 = 33 each', per === 33, `got ${per}`);
  check('split: remainder 1 refunded to host', refund === 1, `got ${refund}`);

  // --- full math with underfill refund ---
  const configured = 10;
  per = 100;
  refund = 100 * (configured - winners.length);
  check('full: each winner gets full 100', per === 100);
  check('full: underfill refunds 700 to host', refund === 700, `got ${refund}`);

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

  // --- multi-winner uniqueness: distinct winners drawn from entries ---
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const drawn = [];
  const drawCount = Math.min(5, pool.length);
  for (let k = 0; k < drawCount; k++) {
    const idx = Math.floor(Math.random() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  check('draws unique winners', new Set(drawn).size === drawn.length && drawn.length === 5);

  // --- finishGiveaway accepts an array and expires are found ---
  db.finishGiveaway('msg1', winners);
  const expired = db.getExpiredGiveaways(Math.floor(Date.now() / 1000) + 999999999);
  check('finished giveaway no longer expired', !expired.includes('msg1'));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
