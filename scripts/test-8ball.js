// Integration/regression test for the LIVE 8ball command path.
// Drives the REAL command handler (prefix -> alias -> case-insensitive lookup ->
// args -> usage/answer logic -> compact response embed), fresh throwaway DB.
// NEVER touches production balances (DB_PATH is redirected to /tmp).
process.env.DB_PATH = '/tmp/8ball_it';
const fs = require('fs');
fs.rmSync('/tmp/8ball_it', { recursive: true, force: true });
fs.mkdirSync('/tmp/8ball_it', { recursive: true });

// --- stub discord.js before anything requires it (no live gateway) ---
// EmbedBuilder records title/fields/description so tests can assert output.
const Module = require('module');
const origLoad = Module._load;

class StubEmbed {
  constructor() { this._title = ''; this._fields = []; this._description = ''; this._color = 0; }
  setColor(c) { this._color = c; return this; }
  setTitle(t) { this._title = t; return this; }
  setDescription(d) { this._description = d; return this; }
  addFields(...args) { for (const a of args) this._fields.push(a); return this; }
  setFooter() { return this; }
  toJSON() { return { title: this._title, fields: this._fields, description: this._description }; }
}
function genericBuilder() {
  const target = {};
  const handler = {
    get(t, p) {
      if (p === 'then') return undefined;
      if (!(p in t)) t[p] = () => proxy;
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; },
  };
  const proxy = new Proxy(target, handler);
  return proxy;
}
const discordStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'EmbedBuilder') return StubEmbed;
    if (prop === 'ButtonStyle' || prop === 'TextInputStyle' || prop === 'ComponentType') return { Primary: 1, Secondary: 2, Success: 3, Danger: 4, Short: 1, Paragraph: 2, Button: 2, StringSelect: 3 };
    if (prop === 'ChannelType') return { GuildText: 0 };
    if (prop === 'Events') return { ClientReady: 'ready', InteractionCreate: 'interactionCreate', MessageCreate: 'messageCreate' };
    if (prop === 'PermissionFlagsBits') return new Proxy({}, { get: () => 0n });
    if (prop === 'Collection') return class extends Map {};
    return function Stub() { return genericBuilder(); };
  },
});
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') return discordStub;
  return origLoad.apply(this, arguments);
};

const assert = require('assert');
const db = require('../db');
const handler = require('../utils/commandHandler');

// Must stay in sync with commands/8ball.js ANSWERS (order matters for RNG bounds).
const ANSWERS = [
  'absolutely 😭', 'yes yes yes', '100% trust', 'the vibes are yes', 'yessss go for it',
  'obviously bestie', 'the universe said yes', 'signs point to yes',
  'hell nah', 'do NOT do that', 'absolutely not 😭', 'the universe said no', 'pls dont', 'signs point to no',
  'lowkey... yeah 😭', 'lowkey...', 'maybe if u lock in', 'give it 5 business days', 'ask ur lawyer',
  'coin says yes, i say no', 'unfortunately yes', 'fortunately no', 'we might be cooked', 'source: trust me',
  'probably 💀', '50/50 bestie', 'depends on ur sleep schedule',
  'bro i dont know 😭', 'i forgot the question already', 'im pretending i didnt hear that',
  'ask again when im awake', 'the magic ball glitched 💀',
  'somehow yes', 'u got this', 'lucky aura detected', 'not looking good gang', 'yeah ur cooked',
  'the voices said yes', 'ur on ur own with this one', 'ask ur rubber duck',
  'i asked the cat, the cat said yes', 'the math says maybe', "it's giving good luck",
  'the stars said its ur day', 'try again after a snack',
];

const MAX_Q = 100;

let seq = 0;
const uid = () => '8b_it_' + (++seq);

function makeMessage(content, userId) {
  const sends = [];
  const channel = {
    id: 'chan_it',
    send(payload) {
      sends.push(payload);
      return Promise.resolve({ delete: () => Promise.resolve(), edit: () => Promise.resolve() });
    },
  };
  return { content, author: { id: userId, bot: false }, guild: null, channel, _sends: sends };
}

async function run(input) {
  const id = uid();
  db.acceptTerms(id);
  const msg = makeMessage(input, id);
  await handler.handleMessage(msg);
  const contentSends = msg._sends.filter(s => typeof s.content === 'string');
  const result = contentSends.filter(s => s.content.startsWith('🎱 **'));
  const usage = contentSends.filter(s => s.content.startsWith('🎱 ask something'));
  const noEmbeds = msg._sends.every(s => !s.embeds);
  let q = null, a = null;
  if (result.length) {
    const lines = result[0].content.split('\n');
    const qm = lines[0].match(/^🎱 \*\*(.+)\*\*$/);
    if (qm) q = qm[1];
    a = lines.slice(1).join('\n') || null;
  }
  return { id, msg, resultCount: result.length, usageCount: usage.length, usageContent: usage[0] && usage[0].content, noEmbeds, q, a };
}

(async () => {
  await db.init();
  handler.loadCommands();

  const cmd = handler.getCommand('8ball');
  assert(cmd, '8ball command did not load');

  const results = [];
  const check = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  console.log('== NO QUESTION: short plain message, NO embed ==');
  let r = await run('v 8ball');
  check('v 8ball -> usage message, no result', r.resultCount === 0 && r.usageCount === 1, `results=${r.resultCount} usage=${r.usageCount}`);
  check('  usage is a plain message with the example, no embeds', r.usageContent === '🎱 ask something 😭\n`v 8b am i cooked`' && r.noEmbeds, `content="${r.usageContent}" embeds=${!r.noEmbeds}`);

  r = await run('v 8b');
  check('v 8b -> usage message, no embed', r.resultCount === 0 && r.usageCount === 1 && r.noEmbeds, `results=${r.resultCount} usage=${r.usageCount}`);

  console.log('\n== VALID QUESTION: plain message, question preserved ==');
  r = await run('v 8ball am i cooked');
  check('v 8ball am i cooked -> one plain response, no embeds', r.resultCount === 1 && r.noEmbeds, `results=${r.resultCount} embeds=${!r.noEmbeds}`);
  check('  question "am i cooked" preserved, answer from pool', r.q === 'am i cooked' && ANSWERS.includes(r.a), `q="${r.q}" a="${r.a}"`);

  r = await run('v 8b does she like me');
  check('v 8b does she like me -> one result, question preserved', r.resultCount === 1 && r.q === 'does she like me', `q="${r.q}"`);

  r = await run('v 8b should i sleep rn?');
  check('v 8b should i sleep rn? -> full question incl. punctuation', r.q === 'should i sleep rn?', `q="${r.q}"`);

  r = await run('v 8ball     what about the extra spaces?');
  check('extra whitespace normalized', r.q === 'what about the extra spaces?', `q="${r.q}"`);

  console.log('\n== ALIAS + CASE ==');
  r = await run('v 8BALL capitalize?');
  check('v 8BALL (upper) resolves', r.resultCount === 1 && r.q === 'capitalize?', `q="${r.q}"`);
  r = await run('v eightball is it ok?');
  check('alias eightball works', r.q === 'is it ok?', `q="${r.q}"`);

  console.log('\n== LONG INPUT: truncated cleanly, still one valid answer ==');
  const huge = 'a'.repeat(600);
  r = await run('v 8ball ' + huge);
  check('600-char question -> one result, truncated, no crash', r.resultCount === 1 && r.q && r.q.length <= MAX_Q + 1 && r.q.endsWith('…'), `qlen=${r.q && r.q.length}`);
  check('  truncated answer still from pool', ANSWERS.includes(r.a), `a="${r.a}"`);

  console.log('\n== PRESENTATION: plain Discord message, no embed ==');
  r = await run('v 8ball whats ur gender');
  check('short question: "🎱 **question**\\nanswer", exactly one response', r.resultCount === 1 && r.q === 'whats ur gender' && r.a && r.noEmbeds, `content="${r.msg._sends.find(s => typeof s.content === 'string' && s.content.startsWith('🎱 **')) && r.msg._sends.find(s => typeof s.content === 'string' && s.content.startsWith('🎱 **')).content}"`);
  r = await run('v 8b am i getting a good grade this week');
  check('long question keeps the same two-line plain layout', r.q === 'am i getting a good grade this week' && r.resultCount === 1 && r.noEmbeds, `q="${r.q}"`);

  console.log('\n== MARKDOWN / MENTION SAFETY ==');
  const esc = s => s.replace(/[\\*_~`>|#@<&]/g, m => '\\' + m);
  const nasty = '@everyone <@123456789> **bold** ||sp|| ~x~ `c` > q?';
  r = await run('v 8ball ' + nasty);
  const out = r.msg._sends.find(s => typeof s.content === 'string' && s.content.startsWith('🎱 **')).content;
  check('visible wording preserved, markdown escaped', r.q === esc(nasty), `q="${r.q}"`);
  check('  no raw user-mention pattern left', !out.includes('<@123456789>'), out);
  check('  no @everyone ping left (escaped with backslash)', out.includes('\\@everyone') && !out.replace('\\@everyone', '').includes('@everyone'), out);
  check('  bold/spoiler/strike/code all neutralized', !out.includes('**bold**') && !out.includes('||sp||') && !out.includes('~x~') && !out.includes('`c`'), out);

  console.log('\n== ANSWER POOL + RNG ==');
  check('pool has 45 unique, non-empty answers', ANSWERS.length === 45 && new Set(ANSWERS).size === 45 && ANSWERS.every(Boolean), `len=${ANSWERS.length} uniq=${new Set(ANSWERS).size}`);

  const realRandom = Math.random;
  r = (await (async () => { Math.random = () => 0.0; const x = await run('v 8b r?'); Math.random = realRandom; return x; })());
  check('random=0.0 -> ANSWERS[0], one answer, in pool', r.resultCount === 1 && r.a === ANSWERS[0] && ANSWERS.includes(r.a), `a="${r.a}"`);
  r = (await (async () => { Math.random = () => 0.999999; const x = await run('v 8b r?'); Math.random = realRandom; return x; })());
  check('random=0.999999 -> last answer, one answer, in pool', r.resultCount === 1 && r.a === ANSWERS[ANSWERS.length - 1] && ANSWERS.includes(r.a), `a="${r.a}"`);
  // middle index (0.5) reads a different entry, never undefined
  r = (await (async () => { Math.random = () => 0.5; const x = await run('v 8b r?'); Math.random = realRandom; return x; })());
  check('random=0.5 -> middle answer reachable', ANSWERS.includes(r.a) && r.a !== ANSWERS[0], `a="${r.a}"`);

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
    process.exit(1);
  }
  console.log('ALL 8BALL INTEGRATION TESTS PASSED');
})();