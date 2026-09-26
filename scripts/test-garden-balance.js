// Balance simulation: Snail Garden (v2.1.0).
// Runs a large Monte Carlo over every runner x {fresh, mid, max-upgraded} and every
// cash-out strategy, and reports the best expected return a player could find.
// The game must NEVER be +EV (expected return per bet must stay <= 1.0) at factor 1.
process.env.DB_PATH = '/tmp/garden_balance';
const fs = require('fs');
fs.rmSync('/tmp/garden_balance', { recursive: true, force: true });
fs.mkdirSync('/tmp/garden_balance', { recursive: true });

const db = require('../db');

const N = 30000;              // sessions per (config, strategy)
const BET = 1000;
const FACTOR = 1;             // worst case for the house = fresh balance factor

const UPGRADE_SETS = {
  fresh: { soil: 0, seeds: 0, net: 0, boots: 0, can: 0 },
  mid:   { soil: 2, seeds: 2, net: 1, boots: 1, can: 0 },
  max:   { soil: 5, seeds: 5, net: 5, boots: 3, can: 1 },
};

let seed = 12345;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function modsFor(runnerKey, up) {
  const r = db.GARDEN_RUNNERS[runnerKey];
  return {
    mult: r.mult, failBase: r.failBase, failStep: r.failStep,
    deepDepth: db.GARDEN_DEEP_DEPTH, maxSteps: 10 + up.boots,
    soil: up.soil, seeds: up.seeds, net: up.net, can: up.can,
  };
}

// One session with a fixed strategy: stop selling after `stopAt` rows (0 = sell now).
// stopAt == Infinity means "plant until failure or the garden is full".
function session(mods, stopAt) {
  let mult = 1;
  let r = 0;
  while (true) {
    if (r >= stopAt) return BET + Math.floor(BET * (mult - 1) * FACTOR);
    const event = db.gardenEvent(r);
    const failPct = Math.min(95, Math.max(1, db.gardenFailAt(mods, r) + (event ? event.fail : 0)));
    const grow = db.gardenRowGrowth(mods, r) * (1 + (event ? event.grow : 0));
    if (rnd() * 100 < failPct) {
      if (r >= mods.deepDepth && mods.net > 0 && rnd() * 100 < mods.net * 4) {
        return BET + Math.floor(BET * (mult - 1) * FACTOR); // safety net sells at current value
      }
      return 0; // row failed, bet lost
    }
    mult *= grow;
    r++;
    if (r >= mods.maxSteps) return BET + Math.floor(BET * (mult - 1) * FACTOR);
  }
}

function bestEv(mods, strategies) {
  let best = -Infinity, bestAt = 0;
  for (const s of strategies) {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += session(mods, s);
    const ev = sum / N / BET;
    if (ev > best) { best = ev; bestAt = s; }
  }
  return { best, bestAt: bestAt === Infinity ? 'full' : bestAt };
}

async function main() {
  await db.init();
  const strategies = [...Array(14).keys(), Infinity]; // 0..13, then plant-until-over
  const rowsOut = [];
  let worst = -Infinity, worstInfo = '';
  for (const [runnerKey, run] of Object.entries(db.GARDEN_RUNNERS)) {
    const line = {};
    for (const [setName, up] of Object.entries(UPGRADE_SETS)) {
      const mods = modsFor(runnerKey, up);
      const { best, bestAt } = bestEv(mods, strategies);
      line[setName] = best;
      if (best > worst) { worst = best; worstInfo = `${runnerKey}/${setName}@stop${bestAt}`; }
    }
    rowsOut.push([`${run.emoji} ${run.name}`, line]);
  }

  console.log('Monte Carlo expected return per 1 coin bet (factor 1.0, N=' + N + '):');
  console.log('  runner           fresh    mid      max');
  for (const [name, line] of rowsOut) {
    const pad = name.padEnd(16);
    console.log(`${pad} ${line.fresh.toFixed(4)}  ${line.mid.toFixed(4)}  ${line.max.toFixed(4)}`);
  }

  const worstPerRunner = Math.max(...rowsOut.map(([, l]) => Math.max(l.fresh, l.mid, l.max)));
  console.log(`\nworst-case (most exploitable) expected return: ${worst.toFixed(4)} at ${worstInfo}`);

  // snail fresh must be ~1.00 exactly (historical anchor)
  const snailMods = modsFor('snail', UPGRADE_SETS.fresh);
  const snailFresh = bestEv(snailMods, strategies).best;
  console.log(`snail/fresh expected return: ${snailFresh.toFixed(4)}`);

  const fails = [];
  if (worst > 1.02) fails.push(`worst ${worst.toFixed(4)} exceeds 1.02`);   // sim tolerance
  if (Math.abs(snailFresh - 1.0) > 0.03) fails.push(`snail fresh drifted from 1.0: ${snailFresh}`);

  // evidence probe: EV vs sell-row for the most aggressive combo (dragon + max)
  const dragonMax = modsFor('dragon', UPGRADE_SETS.max);
  const probeN = 20000;
  console.log('\nevidence: EV vs cash-out row for 🐉 Dragon + max upgrades (N=' + probeN + ')');
  const evs = [];
  for (const s of strategies) {
    let sum = 0;
    for (let i = 0; i < probeN; i++) sum += session(dragonMax, s);
    evs.push([s === Infinity ? 'full' : s, sum / probeN / BET]);
  }
  let overFair = false;
  for (const [at, ev] of evs) {
    if (ev > 1.00001) overFair = true;
    console.log(`  stop@${String(at).padStart(4)}  ${ev.toFixed(4)}`);
  }
  if (overFair) fails.push('dragon/max probe shows a +EV strategy');

  if (fails.length) { console.log(`\nFAIL — ${fails.join('; ')}`); process.exit(1); }
  console.log('\nPASS — no configuration is +EV at factor 1 (worst margin below tolerance).');
}

main().catch(e => { console.error('SIM CRASH', e); process.exit(1); });