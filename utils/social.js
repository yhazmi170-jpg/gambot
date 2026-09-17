const db = require('../db');
const { embed } = require('./embed');
const { pickGif } = require('../commands/socialgifs');

const ACTIONS = {
  hug:    { verb: 'hugs',        react: '🤗' },
  kiss:   { verb: 'kisses',      react: '😘' },
  kill:   { verb: 'annihilates', react: '💀' },
  slap:   { verb: 'slaps',       react: '✋' },
  pat:    { verb: 'pats',        react: '🫳' },
  cuddle: { verb: 'cuddles',     react: '🧸' },
  bite:   { verb: 'bites',       react: '😬' },
  punch:  { verb: 'punches',     react: '👊' },
  lick:   { verb: 'licks',       react: '👅' },
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

  const line = target
    ? `<@${selfId}> ${act.verb} <@${target.id}>`
    : `<@${selfId}> ${SELF_LINE[action]}`;

  const e = embed(`${EMOJI[action]} ${line}`, [], 0x2b2d31);
  e.setImage(gif);
  await message.channel.send({ embeds: [e] });
  await safeSelfReact(message, act.react);
}

module.exports = { execSocial, safeSelfReact, ACTIONS, EMOJI, SELF_LINE };