const crypto = require('crypto');
const os = require('os');
const { version } = require('../package.json');

const bootId = crypto.randomUUID();
const pid = process.pid;
const hostname = os.hostname();
const startedAt = Date.now();
const startedIso = new Date(startedAt).toISOString();
const commit = process.env.RENDER_GIT_COMMIT || process.env.GIT_SHA || process.env.COMMIT_REF || 'unknown';

function shortId() { return String(bootId).slice(0, 8); }
function tag() { return `boot=${shortId()} pid=${pid}`; }
function fields() {
  return { boot_id: bootId, boot_short: shortId(), pid, hostname, started_at: startedIso, started_ms: startedAt, version, commit };
}
function uptimeMs() { return Date.now() - startedAt; }

function printBoot() {
  console.log(`[GAMBOT BOOT] boot_id=${bootId} pid=${pid} hostname=${hostname} started_at=${startedIso} version=v${version} commit=${commit}`);
}

module.exports = { bootId, shortId, tag, fields, uptimeMs, printBoot, pid, hostname, startedAt, startedIso, version, commit };