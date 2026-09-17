const db = require('../db');
const { embed } = require('./embed');
const { pickGif } = require('../commands/socialgifs');

const ACTIONS = {
  hug:    { verb: 'hugs',        react: '🤗' },
  kiss:   { verb: 'kisses',      react: '😘' },
  kill:   { verb: 'annihilates', react: '💀' },
  slap:   { verb: 'slaps',       react: '✋' },
  pat:    { verb: 'pats',        react: '🫳' },
  bonk:   { verb: "bonks",       react: "💨" },
  facepalm: { verb: "facepalms",   react: "🤦" },
  tease:  { verb: "teases",     react: "🤣" },
  cuddle: { verb: 'cuddles',     react: '🧸' },
  bite:   { verb: 'bites',       react: '😬' },
  punch:  { verb: 'punches',     react: '👊' },
  lick:   { verb: 'licks',       react: '👅' },
  wave:    { verb: "waves",       react: "👋" },
  poke:    { verb: "pokes",       react: "👀" },
  tickle:  { verb: "tickles",     react: "🤣" },
  blush:   { verb: "blushes",     react: "😊" },
  cry:     { verb: "cries",       react: "😢" },
  laugh:   { verb: "laughs",      react: "😀" },
  dance:   { verb: "dances",      react: "🕺" },
  stare:   { verb: "stares",      react: "👀" },
};

const EMOJI = {
  hug: '🤗', kiss: '😘', kill: '💀', slap: '✋', pat: '🫳',
  cuddle: '🧸', bite: '😬', punch: '👊', lick: '👅',
};

const SELF_LINE = {
  hug: 'hugs themself. still counts.',
  kiss: 'kisses emself. bold.',
  kill: 'annihilates emself. we win these.',
  slap: 'slaps emself. wake up call.',
  pat: 'pats emself on the head. deserved.',
  cuddle: 'cuddles emself. self care.',
  bite: 'bites emself. snack time??',
  punch: 'punches emself. rival arc.',
  lick: 'licks emself. cat behavior.',
};

/** Nonfatal self-reaction: at most one fitting emoji, never errors on failure. */
async function safeSelfReact(message, emoji) {
  if (!message || !emoji) return;
  try {
    await message.react(emoji);
  } catch (err) {
    // reactions are cosmetic — never let a failure surface as an error
  }
}

async function execSocial(message, action) {
  const act = ACTIONS[action];
  if (!act) return;
  const selfId = message.author.id;
  const target = message.mentions.users.first();
  const gif = pickGif(action);

  db.ensureUser(selfId);
  db.recordActivity(selfId, 'any');
  db.bumpSocial(selfId);

  // Real mention chips only render from message content — Discord does NOT parse
  // <@id> inside embed titles, which is why the old version showed literal IDs.
  // The action line goes in content; the GIF sits in an image-only embed below it.
  let line;
  if (target) {
    // Rare pair milestones only: 1st, then 10/25/50/100/250/500/1000. Otherwise silent.
    let pair = null;
    try { pair = db.bumpSocialPair(selfId, target.id, action); } catch {}
    const suffix = pair && pair.first ? ' for the 1st time!'
      : (pair && pair.milestone ? ` for the ${pair.milestone}th time!` : '');
    line = `${EMOJI[action]} <@${selfId}> ${act.verb} <@${target.id}>${suffix}`;
  } else {
    line = `${EMOJI[action]} <@${selfId}> ${SELF_LINE[action]}`;
  }
  const content = line;
  // Ping ONLY the target. The actor still renders as a mention chip but is never notified.
  const allowedMentions = target
    ? { parse: [], users: [target.id] }
    : { parse: [] };

  const e = embed(null, [], 0x2b2d31);
  e.setImage(gif);
  await message.channel.send({ content, embeds: [e], allowedMentions });
  await safeSelfReact(message, act.react);
}

module.exports = { execSocial, safeSelfReact, ACTIONS, EMOJI, SELF_LINE };