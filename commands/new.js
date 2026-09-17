const pkg = require('../package.json');
const { embed } = require('../utils/embed');

const NEW_FEATURES = [
  ['Social Commands', '`v hug` `v kiss` `v pat` `v slap` `v cuddle` `v bite` `v punch` `v lick` `v kill` — real 2D-anime GIF replies + one self-react, 82 verified clips.'],
  ['Silly Justice System', '`v case` opens a (fake) case file, `v judge` passes a non-binding sentence, `v compare` real stats with certified commentary.'],
  ['Server Lore', '`v lore` records light, rolling history of notable events — achievements, titles, raids, giveaways, events. never message content.'],
  ['`v try`', 'tells you what you have NOT tried yet — assessments, stale features, eggs, quests, dex gaps, inbox, tips. recommendation engine, not random.'],
  ['Community Events', 'rare rotating happenings — The Button, Roll Call, Creature Sighting, Quest Rush, Double Pet XP — announced server-wide.'],
  ['Rare Gambot Summons', 'if you vanish a while, Gambot might tap you once with a nudge (opt-out: `v summon off`). tied to inactivity, never gambling. not a nag.'],
];

module.exports = {
  name: 'new',
  helpCategory: 'Info',
  helpArgs: '[feature]',
  description: 'what is new in this release',
  aliases: ['whatsnew', 'latest'],
  execute(message, args) {
    const q = (args.join(' ') || '').toLowerCase();
    if (q) {
      const hit = NEW_FEATURES.find(([, desc]) => desc.toLowerCase().includes(q));
      return message.channel.send({ embeds: [embed('🔎 v new search', [hit ? [hit[0], hit[1]] : ['no match', 'tip: try `v try` to get targeted suggestions']], 0x2b2d31)] });
    }
    message.channel.send({
      embeds: [embed('✨ Gambot 2.0', [
        ['version', `v${pkg.version} — running since the 2.0 milestone`],
        ...NEW_FEATURES,
        ['', 'for the full catalog run `v help` · for targeted picks run `v try` · mechanics in `v gamehelp`'],
      ], 0x2b2d31)],
    });
  },
};