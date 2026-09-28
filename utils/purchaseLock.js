const locks = new Map();

function withPurchaseLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn());
  const tracked = run.catch(() => {});
  locks.set(key, tracked);
  tracked.then(() => { if (locks.get(key) === tracked) locks.delete(key); });
  return run;
}

module.exports = { withPurchaseLock };