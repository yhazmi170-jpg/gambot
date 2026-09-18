// Verifies the command pipeline reaches cmd.execute for a normal user message.
// Guards against the ReferenceError regression (getLastMeaningfulAt/getLastSummonAt
// were called but undefined, killing every command silently before execute).
process.env.DB_PATH = '/tmp/gw_cmd_test';
const fs = require('fs');
fs.rmSync('/tmp/gw_cmd_test', { recursive: true, force: true });
fs.mkdirSync('/tmp/gw_cmd_test', { recursive: true });

let pass = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
}

async function main() {
  const db = require('../db');
  await db.init();
  const config = require('../config');
  const { loadCommands, handleMessage } = require('../utils/commandHandler');
  loadCommands();

  const ownerId = config.ownerId;
  db.acceptTerms(ownerId);
  db.ensureUser(ownerId);
  db.setBalance(ownerId, 5000);

  // stub Discord message: registered owner sends `v bal`
  let sent = 0;
  const fakeMessage = {
    id: 'm1',
    author: { id: ownerId, bot: false },
    guild: { id: '111' },
    channel: { id: '222', type: 0, send: async () => { sent++; return {}; } },
    mentions: { users: { first: () => null } },
    content: 'v bal',
    react: async () => {},
  };

  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('handleMessage hung')), 5000);
      Promise.resolve(handleMessage(fakeMessage)).then(() => { clearTimeout(t); resolve(); }).catch(reject);
    });
    check('handleMessage did not throw', true);
    check('prefix v parsed, command bal found, execute entered, send attempted', sent >= 1, `sent=${sent}`);
  } catch (e) {
    check('handleMessage did not throw', false, e.stack || e.message);
  }

  // summon helpers return sane values without DB rows
  db.recordActivity(ownerId, 'meaningful');
  const a = db.getActivity(ownerId);
  check('getActivity exposes last_meaningful_at/last_summon_at', a && typeof a.last_meaningful_at === 'number' && typeof a.last_summon_at === 'number');

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });