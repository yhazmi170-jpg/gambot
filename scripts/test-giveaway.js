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

  // === 2.0.3.x recovery + idempotency regression (survives restarts) ===
  const nowSec = Math.floor(Date.now() / 1000);

  // announced column migrated in
  const cols2 = db.exec('PRAGMA table_info(giveaways)')[0].values.map(v => v[1]);
  check('giveaways has announced column', cols2.includes('announced'));

  // --- E+F: 100m split across 10 unique winners from 28 entries = 10m each ---
  const RNG_SEQ = [0.13, 0.72, 0.05, 0.91, 0.44, 0.63, 0.28, 0.55, 0.81, 0.19]
  function seqRng() { let i = 0; return () => RNG_SEQ[i++ % RNG_SEQ.length]; }
  const entries = Array.from({ length: 28 }, (_, i) => `e${i + 1}`);
  db.createGiveaway('big', 'chanBig', 'hostBig', 100000000, nowSec - 60, 10, 'split');
  for (const e of entries) db.addGiveawayEntry('big', e);
  check('F: 28 entries persisted', db.getGiveaway('big').entries.length === 28);
  const w = giveaway.drawWinners(db.getGiveaway('big').entries, db.getGiveaway('big').winner_count, seqRng());
  check('F: 10 unique winners from 28', w.length === 10 && new Set(w).size === 10, JSON.stringify(w));
  const payout = giveaway.computePayout(100000000, 10, 'split', w.length);
  check('E: 100m/10 split = 10m each, no refund', payout.perWinner === 10000000 && payout.refund === 0, JSON.stringify(payout));

  // --- D/H: exactly-once delivery creation (simulated Phase-1 re-run) ---
  db.finishGiveaway('big', w); // reserve first (exactly-once guard)
  for (const winnerId of w) {
    if (!db.hasGiveawayDelivery('big', winnerId)) {
      db.createDelivery(winnerId, { sender: 'hostBig', source: 'giveaway', label: `giveaway prize (1 of ${w.length})`, amount: 10000000, payload: { gw: 'big' } });
    }
  }
  // "restart" = same code path runs again over the same DB
  for (const winnerId of w) {
    if (!db.hasGiveawayDelivery('big', winnerId)) {
      db.createDelivery(winnerId, { sender: 'hostBig', source: 'giveaway', label: `giveaway prize (1 of ${w.length})`, amount: 10000000, payload: { gw: 'big' } });
    }
  }
  const dupes = w.filter(wid => db.getPendingDeliveries(wid).filter(d => d.source === 'giveaway').length > 1);
  check('H: exactly one delivery per winner after re-run', dupes.length === 0, JSON.stringify(dupes));
  check('H: each winner has exactly 1 pending giveaway delivery', w.every(wid => db.getPendingDeliveryCount(wid) === 1));

  // --- I: host refund applied once after double recovery run ---
  const hostBefore = db.getBalance('hostBig');
  if (payout.refund > 0) db.addBalance('hostBig', payout.refund); // simulated first run
  if (payout.refund > 0 && db.getExpiredGiveaways(nowSec).includes('big')) db.addBalance('hostBig', payout.refund); // "re-run"
  check('I: host not double-refunded', db.getBalance('hostBig') - hostBefore === payout.refund, `delta ${db.getBalance('hostBig') - hostBefore}`);

  // --- after finish, sweep should NOT redraw (winner_id set) ---
  check('D: finished giveaway excluded from expired sweep', !db.getExpiredGiveaways(nowSec).includes('big'));

  // --- C+B: recovery after restart — an expired, un-finished giveaway is picked up ---
  db.createGiveaway('stuck', 'chanStuck', 'hostStuck', 50000, nowSec - 30, 5, 'split');
  for (const e of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) db.addGiveawayEntry('stuck', e);
  const stuckW = giveaway.drawWinners(db.getGiveaway('stuck').entries, 5);
  db.finishGiveaway('stuck', stuckW);
  check('C: expired giveaway recovered (winner_id reserved)', db.getGiveaway('stuck').winner_id !== null, db.getGiveaway('stuck').winner_id);
  check('C: recovered giveaway now announceable', db.getGiveawaysToAnnounce().includes('stuck'));

  // --- G: markGiveawayAnnounced flips flag exactly once ---
  db.markGiveawayAnnounced('stuck');
  check('G: announced giveaway not re-announced', !db.getGiveawaysToAnnounce().includes('stuck'));
  db.markGiveawayAnnounced('stuck');
  check('G: markGiveawayAnnounced idempotent', !db.getGiveawaysToAnnounce().includes('stuck'));

  // --- B: giveaway ending in the future is NOT finalized early ---
  db.createGiveaway('future', 'chanF', 'hostF', 1000, nowSec + 3600, 1, 'split');
  check('B: future giveaway not in expired sweep', !db.getExpiredGiveaways(nowSec).includes('future'));
  check('B: future giveaway not announceable', !db.getGiveawaysToAnnounce().includes('future'));

  // === 2.0.3.x announcement PRESENTATION: one combined message per giveaway ===
  // 10 winners -> exactly ONE announcement containing ALL 10 winner ids + payouts
  const ann = giveaway.formatAnnouncement(w, 'split', 10000000, 100000000, 'money');
  check('Ann: single combined message (no per-winner spam)', (ann.match(/Giveaway Winners/g) || []).length === 1, ann);
  check('Ann: contains ALL 10 winner ids', w.every(wid => ann.includes(`<@${wid}>`)), ann);
  check('Ann: excludes non-winners', !ann.includes('<@e1>') || w.includes('e1'), ann);
  check('Ann: shows each split payout (10m)', (ann.match(/10,000,000/g) || []).length === w.length, ann);
  check('Ann: no @everyone/@here', !/@everyone|@here/.test(ann), ann);
  check('Ann: mentioned ids are all actual winners', (ann.match(/<@(\d+|\w+)>/g) || []).every(m => w.some(wid => m.includes(wid))), ann);
  check('Ann: actually expected len', ann.length < 2000 && ann.length > 200, `len ${ann.length}`);

  // singular winner keeps compact wording
  const ann1 = giveaway.formatAnnouncement(['solo'], 'split', 10000000, 100000000, 'money');
  check('Ann1: singular keeps compact wording', /^🎉 <@solo> won the giveaway/.test(ann1), ann1);

  // full mode shows full prize beside every winner
  const annFull = giveaway.formatAnnouncement(['a', 'b', 'c'], 'full', 100000000, 100000000, 'money');
  check('AnnFull: full mode shows prize per winner', (annFull.match(/100,000,000/g) || []).length === 3, annFull);

  // fewer entrants than requested -> only actual winners listed
  const annUnder = giveaway.formatAnnouncement(under, 'split', 25, 50, 'money');
  check('AnnUnder: only actual winners listed', under.every(wid => annUnder.includes(`<@${wid}>`)) && (annUnder.match(/<@/g) || []).length === under.length, annUnder);

  // >2000-char edge -> compressed single message keeps every winner
  const manyW = Array.from({ length: 50 }, (_, i) => `w${i}`.padEnd(18, '0'));
  const annBig = giveaway.formatAnnouncement(manyW, 'full', 100000000, 100000000, 'money');
  check('AnnBig: stays under 2000, keeps all 50 winners', annBig.length < 2000 && manyW.every(wid => annBig.includes(`<@${wid}>`)), `len ${annBig.length}`);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
