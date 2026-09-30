const runtime = require('./runtime');

// keyed per owner-equivalent account so the owner AND the alt each get exactly one
// boot DM (a plain boolean made the second admin silently skip it)
const notified = new Set();
let dmCount = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function dmBody(client) {
  return [
    'Gambot Restarted',
    `Boot ID: ${runtime.shortId()}`,
    `PID: ${process.pid}`,
    `Host: ${runtime.hostname}`,
    `Started: ${runtime.startedIso}`,
    `Version: v${runtime.version}`,
    `Guilds: ${client && client.guilds && client.guilds.cache ? client.guilds.cache.size : '?'}`,
  ].join('\n');
}

// One startup DM per bot boot: a second ready inside the same process (login
// retry, destroy+relogin watchdog path) must NOT re-DM. Returns true when this
// boot's DM was dispatched (or attempted); false when a ready re-fired.
function onGatewayReady(client, ownerId, opts = {}) {
  if (notified.has(ownerId)) {
    console.log(`[STARTUP_DM_SKIP] ready fired again in this boot — DM already dispatched owner=${ownerId} (${runtime.tag()})`);
    return false;
  }
  notified.add(ownerId);
  const delay = Number.isFinite(opts.retryDelayMs) ? opts.retryDelayMs : 3000;
  sendStartupDm(client, ownerId, delay).catch(() => {});
  return true;
}

async function sendStartupDm(client, ownerId, retryDelayMs = 3000) {
  try {
    // every owner-equivalent account (owner + alt) gets the boot DM
    const u = await client.users.fetch(ownerId, { force: true });
    const body = dmBody(client);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await u.send(body);
        dmCount++;
        console.log(`[STARTUP_DM_SENT] boot=${runtime.shortId()} pid=${process.pid} owner=${ownerId} attempt=${attempt}`);
        return true;
      } catch (e) {
        if (attempt === 1) {
          console.error(`[STARTUP_DM_RETRY] ${runtime.tag()} owner=${ownerId} attempt 1 failed: ${e && e.message}`);
          await sleep(retryDelayMs);
        } else {
          console.error(`[STARTUP_DM_FAILED] ${runtime.tag()} owner=${ownerId} attempt=2 error=${e && e.message}`);
        }
      }
    }
    return false;
  } catch (e) {
    console.error(`[STARTUP_DM_FAILED] ${runtime.tag()} owner=${ownerId} fetch_error=${e && e.message}`);
    return false;
  }
}

function gatewayResumed() {
  console.log(`[GATEWAY_RESUME] ${runtime.tag()} — resumed session (NOT a restart, no startup DM)`);
}
function gatewayReconnecting() {
  console.log(`[GATEWAY_RECONNECT] ${runtime.tag()} — reconnect attempt (NOT a restart, no startup DM)`);
}

function getDmCount() { return dmCount; }
function _resetForTests() { notified.clear(); dmCount = 0; }

module.exports = {
  onGatewayReady, sendStartupDm, gatewayResumed, gatewayReconnecting,
  getDmCount, _resetForTests,
};