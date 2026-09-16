// Integration/regression test for the LIVE 8ball command path.
// Drives the REAL command handler (prefix -> alias -> case-insensitive lookup ->
// args -> validation -> random answer -> Discord REPLAY + optional self reaction),
// fresh throwaway DB. NEVER touches production balances (DB_PATH redirected).
process.env.DB_PATH = '/tmp/8ball_it';
const fs = require('fs');
fs.rmSync('/tmp/8ball_it', { recursive: true, force: true });
fs.mkdirSync('/tmp/8ball_it', { recursive: true });

// --- stub discord.js before anything requires it (no live gateway) ---
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
  'absolutely', 'yes yes yes', '100% trust', 'the vibes are yes', 'yessss go for it',
  'obviously bestie', 'the universe said yes', 'signs point to yes',
  'hell nah', 'do NOT do that', 'absolutely not', 'the universe said no', 'pls dont', 'signs point to no',
  'lowkey... yeah', 'lowkey...', 'maybe if u lock in', 'give it 5 business days', 'ask ur lawyer',
  'coin says yes, i say no', 'unfortunately yes', 'fortunately no', 'we might be cooked', 'source: trust me',
  'probably', '50/50 bestie', 'depends on ur sleep schedule',
  'bro i dont know', 'i forgot the question already', 'im pretending i didnt hear that',
  'ask again when im awake', 'the magic ball glitched',
  'somehow yes', 'u got this', 'lucky aura detected', 'not looking good gang', 'yeah ur cooked',
  'the voices said yes', 'ur on ur own with this one', 'ask ur rubber duck',
  'i asked the cat, the cat said yes', 'the math says maybe', "it's giving good luck",
  'the stars said its ur day', 'try again after a snack',
];

let seq = 0;
const uid = () => '8b_it_' + (++seq);

function makeMessage(content, userId, opts = {}) {
  const sends = [];
  const replies = [];
  const channel = {
    id: 'chan_it',
    send(p) { sends.push(p); return Promise.resolve({ delete: () => Promise.resolve() }); },
  };
  return {
    content,
    author: { id: userId, bot: false },
    guild: null,
    channel,
    _sends: sends,
    _replies: replies,
    reply(payload) {
      const sent = {
        reactions: [],
        react(e) {
          if (opts.failReact) return Promise.reject(new Error('no add-reactions perm'));
          sent.reactions.push(e);
          return Promise.resolve(sent);
        },
      };
      replies.push({ payload, sent });
      return Promise.resolve(sent);
    },
  };
}

function forcedRandoms(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

async function run(input, randoms, opts) {
  const id = uid();
  db.acceptTerms(id);
  const msg = makeMessage(input, id, opts);
  const realRandom = Math.random;
  if (randoms) Math.random = forcedRandoms(randoms);
  try {
    await handler.handleMessage(msg);
  } finally {
    Math.random = realRandom;
  }
  const rp = msg._replies[0];
  return {
    msg,
    replyCount: msg._replies.length,
    sendCount: msg._sends.length,
    content: rp ? rp.payload.content : null,
    payload: rp ? rp.payload : null,
    sent: rp ? rp.sent : null,
    reactions: rp ? rp.sent.reactions.slice() : [],
  };
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

  console.log('== REPLY FORMAT: only the answer, no question/emoji/embed ==');
  let r = await run('v 8b do we do mines all', [0.5, 0.99]);
  check('v 8b -> one actual Discord reply', r.replyCount === 1 && r.sent !== null, `replies=${r.replyCount}`);
  check('  reply content is ONLY the random answer', r.content === ANSWERS[22], `content="${r.content}"`);
  check('  question NOT repeated', r.content && !r.content.includes('do we do mines all'), r.content);
  check('  no 🎱 / no embed / no manual mention', !r.content.includes('🎱') && !r.payload.embeds && r.payload.allowedMentions.repliedUser === false, JSON.stringify(r.payload));

  r = await run('v 8ball am i cooked', [0.0, 0.99]);
  check('v 8ball am i cooked -> answer only', r.content === ANSWERS[0] && !r.content.includes('am i cooked'), `content="${r.content}"`);

  console.log('\n== NO QUESTION: tiny usage reply ==');
  r = await run('v 8b');
  check('v 8b -> one reply, no embed', r.replyCount === 1 && !r.payload.embeds && r.content.length <= 40, JSON.stringify(r.payload && r.payload.content));
  check('  usage text says ask something', r.content && r.content.includes('ask something'), r.content);

  console.log('\n== REACTIONS: self-reaction on OWN reply (max one, 35/20/45) ==');
  r = await run('v 8b should i?', [0.5, 0.1]);
  check('roll<0.35 -> 😭 on own sent message', r.reactions.length === 1 && r.reactions[0] === '😭', JSON.stringify(r.reactions));
  r = await run('v 8b should i?', [0.5, 0.45]);
  check('0.35<=roll<0.55 -> ☠️', r.reactions.length === 1 && r.reactions[0] === '☠️', JSON.stringify(r.reactions));
  r = await run('v 8b should i?', [0.5, 0.9]);
  check('roll>=0.55 -> no reaction', r.reactions.length === 0, JSON.stringify(r.reactions));
  check('  exactly ONE reply each time (no extra channel spam)', r.replyCount === 1, `replies=${r.replyCount}`);
  for (const roll of [0.01, 0.34, 0.35, 0.54, 0.55, 0.99]) {
    r = await run('v 8b should i?', [0.5, roll]);
    check(`  roll=${roll} -> at most one reaction`, r.reactions.length <= 1, JSON.stringify(r.reactions));
  }
  r = await run('v 8b should i?', [0.5, 0.1], { failReact: true });
  check('  reaction failure does NOT break the answer', r.content === ANSWERS[22] && r.reactions.length === 0, `content="${r.content}"`);
  check('  reaction failure sends no error message', r.sendCount === 0, `sends=${r.sendCount}`);

  console.log('\n== ALIASES / PARSER still intact ==');
  r = await run('v 8BALL capitalize?', [0.5, 0.99]);
  check('v 8BALL (upper) resolves to a reply', r.replyCount === 1 && ANSWERS.includes(r.content), JSON.stringify(r.content));
  r = await run('v eightball is it ok?', [0.5, 0.99]);
  check('alias eightball works', r.replyCount === 1 && ANSWERS.includes(r.content), JSON.stringify(r.content));
  r = await run('v 8ball should i sleep rn?', [0.5, 0.99]);
  check('question captured but never rendered', r.replyCount === 1 && !r.content.includes('should i sleep rn?'), r.content);

  console.log('\n== ANSWER POOL: still 45, clean of decorative emojis, reachable ==');
  check('45 unique, non-empty answers', ANSWERS.length === 45 && new Set(ANSWERS).size === 45 && ANSWERS.every(Boolean), `len=${ANSWERS.length} uniq=${new Set(ANSWERS).size}`);
  check('no decorative 😭/☠️/💀 left in any answer', ANSWERS.every(a => !a.includes('😭') && !a.includes('☠️') && !a.includes('💀')), ANSWERS.filter(a => /[😭☠️💀]/.test(a)).join('|'));
  r = await run('v 8b r?', [0.0, 0.99]);
  check('random=0.0 -> ANSWERS[0] reachable', r.content === ANSWERS[0], r.content);
  r = await run('v 8b r?', [0.999999, 0.99]);
  check('random=0.999999 -> last answer reachable', r.content === ANSWERS[ANSWERS.length - 1], r.content);

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
    process.exit(1);
  }
  console.log('ALL 8BALL INTEGRATION TESTS PASSED');
})();