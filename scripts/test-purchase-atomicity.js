// test-purchase-atomicity.js — deterministic coverage for atomic shop purchase
// semantics (db.purchasePerk). Isolated DB only, never touches production data.
//   A. perk INSERT fails after debit      -> balance restored, no entitlement
//   B. entitlement verification fails      -> rolled back, no charge
//   C. disk persistence throws             -> in-memory AND disk both unchanged
//   D. success                             -> exact debit, entitlement, expires_at
//   E. restart                             -> state survives reload from disk
//   F. same purchase twice sequentially    -> one debit
//   G. same purchase concurrently          -> one debit, one record
//   H. second "runtime" reuses purchaseId  -> replay, no charge
//   I. final invariant chain               -> failure-then-success + restart + replay
process.env.DB_PATH = '/tmp/purchase_atomic_test';
const DB_PATH = '/tmp/purchase_atomic_test';
const fs = require('fs');
fs.rmSync('/tmp/purchase_atomic_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/purchase_atomic_test', { recursive: true });

const assert = require('assert');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + label + (extra ? '  — ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  — ' + extra : '')); }
};

const PRICE = 1500000;
const U = 'purchase_tester';
const PERK = 'auto_react';

(async () => {
  const db = require('../db');
  await db.init();
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const fsMod = fs;

  const balanceOf = (handle, id) => {
    const r = handle.exec('SELECT balance FROM users WHERE user_id = ?', [id]);
    return (r && r.length && r[0].values.length) ? Number(r[0].values[0][0]) : 0;
  };
  const perkCount = (handle, id, perk) => {
    const r = handle.exec('SELECT COUNT(*) FROM purchases WHERE user_id = ? AND perk = ?', [id, perk]);
    return (r && r.length) ? Number(r[0].values[0][0]) : 0;
  };
  const txnCount = (handle, purchaseId) => {
    const r = handle.exec('SELECT COUNT(*) FROM purchase_transactions WHERE purchase_id = ?', [purchaseId]);
    return (r && r.length) ? Number(r[0].values[0][0]) : 0;
  };
  const expiresOf = (handle, id, perk) => {
    const r = handle.exec('SELECT expires_at FROM purchases WHERE user_id = ? AND perk = ?', [id, perk]);
    return (r && r.length && r[0].values.length) ? Number(r[0].values[0][0]) : null;
  };
  const resetUser = (handle, balance) => {
    handle.exec('DELETE FROM purchases WHERE user_id = ?', [U]);
    handle.exec('DELETE FROM purchase_transactions WHERE user_id = ?', [U]);
    handle.exec(`INSERT OR REPLACE INTO users (user_id, balance) VALUES (?, ?)`, [U, balance]);
  };

  // ---- TEST A: perk INSERT fails after debit -------------------------------
  {
    resetUser(db, 5000000);
    const res = db.purchasePerk(U, PERK, PRICE, 0, 'pA', {
      beforeGrant: () => { throw new Error('forced insert failure'); },
    });
    check('A success=false on grant failure', res.success === false);
    check('A balance unchanged (5,000,000)', balanceOf(db, U) === 5000000, `got ${balanceOf(db, U)}`);
    check('A no entitlement', db.hasPerk(U, PERK) === false);
    check('A no committed record', txnCount(db, 'pA') === 0);
  }

  // ---- TEST B: entitlement verification fails ------------------------------
  {
    resetUser(db, 5000000);
    const res = db.purchasePerk(U, PERK, PRICE, 0, 'pB', {
      afterGrant: () => { db.exec('DELETE FROM purchases WHERE user_id = ? AND perk = ?', [U, PERK]); },
    });
    check('B success=false on verification failure', res.success === false);
    check('B balance unchanged (5,000,000)', balanceOf(db, U) === 5000000, `got ${balanceOf(db, U)}`);
    check('B no entitlement', db.hasPerk(U, PERK) === false);
    check('B no committed record', txnCount(db, 'pB') === 0);
  }

  // ---- TEST C: filesystem persistence throws -------------------------------
  {
    resetUser(db, 5000000);
    db.setBalance(U, 5000000);
    const origRename = fsMod.renameSync;
    let res;
    try {
      fsMod.renameSync = () => { throw new Error('disk full'); };
      res = db.purchasePerk(U, PERK, PRICE, 0, 'pC');
    } finally {
      fsMod.renameSync = origRename;
    }
    check('C success=false on persist failure', res.success === false);
    check('C flagged persistError', res.persistError === true);
    check('C in-memory balance unchanged (5,000,000)', balanceOf(db, U) === 5000000, `got ${balanceOf(db, U)}`);
    check('C in-memory no entitlement', db.hasPerk(U, PERK) === false);
    const diskDb = new SQL.Database(fs.readFileSync(DB_PATH + '/gambot.db'));
    check('C DISK balance unchanged (5,000,000)', balanceOf(diskDb, U) === 5000000, `got ${balanceOf(diskDb, U)}`);
    check('C DISK no entitlement', perkCount(diskDb, U, PERK) === 0);
    check('C DISK no committed record', txnCount(diskDb, 'pC') === 0);
    diskDb.close();
  }

  // ---- TEST D: success ------------------------------------------------------
  {
    resetUser(db, 5000000);
    const res = db.purchasePerk(U, PERK, PRICE, 0, 'pD');
    check('D success=true', res.success === true && res.replay === false);
    check('D balance = 3,500,000', balanceOf(db, U) === 3500000, `got ${balanceOf(db, U)}`);
    check('D entitlement exists', db.hasPerk(U, PERK) === true);
    check('D expires_at = 0', expiresOf(db, U, PERK) === 0);
    check('D committed record exists', txnCount(db, 'pD') === 1);
  }

  // ---- TEST E: restart (fresh load from disk) ------------------------------
  {
    await db.init();
    check('E balance survives restart', balanceOf(db, U) === 3500000, `got ${balanceOf(db, U)}`);
    check('E entitlement survives restart', db.hasPerk(U, PERK) === true);
    check('E expiry survives restart', expiresOf(db, U, PERK) === 0);
  }

  // ---- TEST F: same purchase twice sequentially ----------------------------
  {
    const res2 = db.purchasePerk(U, PERK, PRICE, 0, 'pD');
    check('F second attempt is replay', res2.success === true && res2.replay === true);
    check('F balance still 3,500,000', balanceOf(db, U) === 3500000, `got ${balanceOf(db, U)}`);
    check('F one entitlement row', perkCount(db, U, PERK) === 1);
    check('F one committed record', txnCount(db, 'pD') === 1);
  }

  // ---- TEST G: same purchase concurrently ----------------------------------
  {
    resetUser(db, 5000000);
    const calls = [
      db.purchasePerk(U, PERK, PRICE, 0, 'pG'),
      db.purchasePerk(U, PERK, PRICE, 0, 'pG'),
    ];
    const results = await Promise.all(calls);
    check('G both report success (one commit, one replay)', results.every(r => r.success === true));
    check('G exactly one real commit', results.filter(r => r.replay === false).length === 1, JSON.stringify(results.map(r => r.replay)));
    check('G balance = 3,500,000', balanceOf(db, U) === 3500000, `got ${balanceOf(db, U)}`);
    check('G one entitlement row', perkCount(db, U, PERK) === 1);
    check('G one committed record', txnCount(db, 'pG') === 1);
  }

  // ---- TEST H: second runtime reusing the same persisted purchaseId --------
  {
    const resH = db.purchasePerk(U, PERK, PRICE, 0, 'pG');
    check('H replay on second runtime', resH.success === true && resH.replay === true);
    check('H no double charge across runtimes', balanceOf(db, U) === 3500000, `got ${balanceOf(db, U)}`);
    const diskDb = new SQL.Database(fs.readFileSync(DB_PATH + '/gambot.db'));
    check('H disk proves single record', txnCount(diskDb, 'pG') === 1 && perkCount(diskDb, U, PERK) === 1);
    diskDb.close();
  }

  // ---- TEST I: final invariant chain ---------------------------------------
  {
    resetUser(db, 5000000);
    check('I BEFORE: balance = 5,000,000, no perk', balanceOf(db, U) === 5000000 && db.hasPerk(U, PERK) === false);
    const failRes = db.purchasePerk(U, PERK, PRICE, 0, 'pInv', {
      beforeGrant: () => { throw new Error('injected failure after debit'); },
    });
    check('I injected failure reported', failRes.success === false);
    check('I AFTER failure: balance = 5,000,000, no perk', balanceOf(db, U) === 5000000 && db.hasPerk(U, PERK) === false);

    const okRes = db.purchasePerk(U, PERK, PRICE, 0, 'pInv');
    check('I SAME id completes after rollback', okRes.success === true && okRes.replay === false);
    check('I AFTER success: balance = 3,500,000', balanceOf(db, U) === 3500000, `got ${balanceOf(db, U)}`);
    check('I AFTER success: perk exists + expires_at 0', db.hasPerk(U, PERK) === true && expiresOf(db, U, PERK) === 0);

    await db.init();
    check('I AFTER RESTART: balance = 3,500,000, perk stays', balanceOf(db, U) === 3500000 && db.hasPerk(U, PERK) === true);

    const replayRes = db.purchasePerk(U, PERK, PRICE, 0, 'pInv');
    check('I same id replayed again', replayRes.success === true && replayRes.replay === true);
    check('I balance STILL 3,500,000 after replay', balanceOf(db, U) === 3500000, `got ${balanceOf(db, U)}`);
    check('I one entitlement row total', perkCount(db, U, PERK) === 1);
    check('I one committed record total', txnCount(db, 'pInv') === 1);
  }

  const total = pass + fail;
  console.log(`\nPURCHASE ATOMICITY: ${pass}/${total} passed${fail ? `, ${fail} FAILED` : ''}`);
  if (fail > 0) process.exit(1);
  process.exit(0);
})();