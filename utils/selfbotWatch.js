const config = require('../config');

const OWNER = config.ownerId || '536278876247162882';
const INTERVAL = 60000;
const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 2;

const state = {
  online: null,
  uptimeMs: null,
  checkedAt: null,
  data: null,
  error: null,
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  checkRunning: false,
};

function dm(client, text) {
  if (!client || !client.user) return;
  client.users.fetch(OWNER).then(u => u.send(text).catch(() => {})).catch(() => {});
}

async function fetchHealth() {
  if (!config.selfbotUrl) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${config.selfbotUrl}/health`, { signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    clearTimeout(t);
    return { ok: res.ok, ...(data || {}) };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: e && e.message };
  }
}

async function check(client) {
  if (state.checkRunning) return;
  state.checkRunning = true;
  const h = await fetchHealth();
  state.checkedAt = Date.now();

  if (!h || !h.ok) {
    state.consecutiveFailures++;
    state.consecutiveSuccesses = 0;
    if (state.online === true && state.consecutiveFailures >= FAILURE_THRESHOLD) {
      dm(client, '⚠️ **selfbot** went offline — no longer responding to /health');
      state.online = false;
    }
    if (state.online !== true && state.consecutiveFailures >= FAILURE_THRESHOLD) {
      state.uptimeMs = null;
      state.data = null;
    }
    state.error = (h && h.error) || 'non-200 response';
    state.checkRunning = false;
    return;
  }

  state.consecutiveFailures = 0;
  state.consecutiveSuccesses++;
  const uptime = typeof h.uptime === 'number' ? h.uptime : null;
  const wasOffline = state.online === false && state.consecutiveSuccesses >= RECOVERY_THRESHOLD;
  const prevUptime = state.uptimeMs;
  const firstEver = state.checkedAt != null && state.online === null;

  if (state.online === null || state.online === true || wasOffline)
    state.online = true;
  state.uptimeMs = uptime;
  state.data = h;
  state.error = null;

  if (firstEver) {
    state.checkRunning = false;
    return;
  }

  if (wasOffline) {
    dm(client, `✅ **selfbot** is back online (${h.clients != null ? h.clients : '?'} clients, v${h.version || '?'})`);
  } else if (prevUptime != null && uptime != null && prevUptime - uptime > 10000) {
    dm(client, `✅ **selfbot** restarted — new deploy live (${h.clients != null ? h.clients : '?'} clients, v${h.version || '?'})`);
  }
  state.checkRunning = false;
}

function getStatus() {
  if (state.checkedAt == null) return null;
  return {
    online: state.online,
    clients: state.data ? state.data.clients : null,
    version: state.data ? state.data.version : null,
    uptimeMs: state.uptimeMs,
    error: state.error,
    url: config.selfbotUrl,
    checkedAt: state.checkedAt,
  };
}

async function renderRestart() {
  if (!config.renderApiKey || !config.selfbotServiceId) {
    throw new Error('selfbot restart is not configured (RENDER_API_KEY / SELFBOT_SERVICE_ID)');
  }
  const res = await fetch(`https://api.render.com/v1/services/${config.selfbotServiceId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.renderApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(body && body.message ? body.message : `HTTP ${res.status}`);
  }
  return { id: body.id, status: body.status };
}

function start(client) {
  check(client);
  setInterval(() => check(client), INTERVAL);
}

module.exports = { start, check, getStatus, renderRestart };
