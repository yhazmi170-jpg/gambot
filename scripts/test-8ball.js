// Integration/regression test for the LIVE 8ball command path.
// Drives the REAL command handler (prefix -> alias -> case-insensitive lookup ->
// args -> validation -> random answer -> Discord REPLY + context-aware self
// reaction keyed off the specific answer), fresh throwaway DB.
// NEVER touches production balances (DB_PATH redirected).
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

const db = require('../db');
const handler = require('../utils/commandHandler');
const { ANSWERS } = require('../commands/8ball');

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
  const assert = require('assert');
  await db.init();
  handler.loadCommands();

  const cmd = handler.getCommand('8ball');
  assert(cmd, '8ball command did not load');

  const results = [];
  const check = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  console.log('== ANSWER POOL: structured, 45 unique, one reaction each, clean ==');
  check('45 entries with text + reaction', ANSWERS.length === 45 && ANSWERS.every(a => a && a.text && a.reaction), `len=${ANSWERS.length}`);
  check('  all texts unique + non-empty', new Set(ANSWERS.map(a => a.text)).size === 45 && ANSWERS.every(a => a.text.trim().length > 0), `uniq=${new Set(ANSWERS.map(a => a.text)).size}`);
  check('  all reactions defined', ANSWERS.every(a => a.reaction !== undefined && a.reaction !== null && a.reaction !== ''), ANSWERS.filter(a => !a.reaction).map(a => a.text).join('|'));
  check('  reactions limited to 😭/☠️ personality', ANSWERS.every(a => ['😭', '☠️'].includes(a.reaction)), [...new Set(ANSWERS.map(a => a.reaction))].join(' '));
  check('  no decorative emoji duplicates in answer text', ANSWERS.every(a => !/😭☠️💀🙏💔/.test(a.text)), ANSWERS.map(a => a.text).filter(t => /[😭☠️💀🙏💔]/.test(t)).join('|'));
  check('  no "gang" left, "not looking good gng" present', ANSWERS.every(a => !/\bgang\b/.test(a.text)) && ANSWERS.some(a => a.text === 'not looking good gng'), ANSWERS.map(a => a.text).filter(t => /\bgang\b/.test(t)).join('|'));

  console.log('\n== ANSWER->REACTION MAPPING (deterministic, one per answer) ==');
  const mappingBads = [];
  for (let i = 0; i < ANSWERS.length; i++) {
    const r = await run('v 8b r?', [(i + 0.5) / ANSWERS.length]);
    if (!(r.replyCount === 1 && r.content === ANSWERS[i].text && r.reactions.length === 1 && r.reactions[0] === ANSWERS[i].reaction)) {
      mappingBads.push(`${i}:"${ANSWERS[i].text}" -> got ${JSON.stringify(r.content)} / ${JSON.stringify(r.reactions)}, want ${ANSWERS[i].reaction}`);
    }
  }
  check('  all 45 answers return their exact assigned reaction', mappingBads.length === 0, mappingBads.join(' | '));

  console.log('\n== REPLY FORMAT: only the answer, real reply, no extras ==');
  let r = await run('v 8b do we do mines all', [0.0]);
  check('v 8b -> one actual Discord reply', r.replyCount === 1 && r.sent !== null, `replies=${r.replyCount}`);
  check('  reply content is ONLY the selected answer', r.content === ANSWERS[0].text, `content="${r.content}"`);
  check('  question NOT repeated', r.content && !r.content.includes('do we do mines all'), r.content);
  check('  no 🎱 / no embed / no manual mention ping', !r.content.includes('🎱') && !r.payload.embeds && r.payload.allowedMentions.repliedUser === false, JSON.stringify(r.payload));
  r = await run('v 8ball am i cooked', [36 / 45]);
  check('v 8ball am i cooked -> answer + its own ☠️ reaction', r.content === ANSWERS[36].text && r.reactions.length === 1 && r.reactions[0] === '☠️', JSON.stringify({ content: r.content, reactions: r.reactions }));

  console.log('\n== ANSWER SELECTION STILL RANDOM (via Math.random index) ==');
  const seen = new Set();
  for (let i = 0; i < 45; i++) seen.add((await run('v 8b r?', [(i + 0.37) / 45])).content);
  check('all 45 answers reachable across forced rolls', seen.size === 45, `distinct=${seen.size}`);

  console.log('\n== NO QUESTION: tiny usage reply ==');
  r = await run('v 8b');
  check('v 8b -> one reply, no embed', r.replyCount === 1 && !r.payload.embeds && r.content.length <= 40, JSON.stringify(r.payload && r.payload.content));
  check('  usage text says ask something', r.content && r.content.includes('ask something'), r.content);

  console.log('\n== SELF-REACTION: own sent message, exactly one, failure-safe ==');
  r = await run('v 8b should i?', [9 / 45]);
  check('reaction lands on Gambot OWN reply (sent stub)', r.replyCount === 1 && r.reactions.length === 1 && r.reactions[0] === ANSWERS[9].reaction, JSON.stringify(r.reactions));
  r = await run('v 8b should i?', [9 / 45], { failReact: true });
  check('  reaction failure does NOT break the answer', r.content === ANSWERS[9].text && r.reactions.length === 0, `content="${r.content}"`);
  check('  reaction failure sends no error message', r.sendCount === 0, `sends=${r.sendCount}`);

  console.log('\n== ALIASES / PARSER / LENGTH still intact ==');
  r = await run('v 8BALL capitalize?', [0.5]);
  check('v 8BALL (upper) resolves to a reply', r.replyCount === 1 && ANSWERS.some(a => a.text === r.content), JSON.stringify(r.content));
  r = await run('v eightball is it ok?', [0.5]);
  check('alias eightball works', r.replyCount === 1 && ANSWERS.some(a => a.text === r.content), JSON.stringify(r.content));
  r = await run('v 8ball ' + 'x'.repeat(600) + '?');
  check('600-char question handled, answer still reply + mapped reaction', r.replyCount === 1 && ANSWERS.some(a => a.text === r.content) && r.reactions.length === 1 && ANSWERS.find(a => a.text === r.content).reaction === r.reactions[0], JSON.stringify({ content: r.content && r.content.length, reactions: r.reactions }));

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
    process.exit(1);
  }
  console.log('ALL 8BALL INTEGRATION TESTS PASSED');
})();