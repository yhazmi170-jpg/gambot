const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');

const prefix = config.prefixes[0];

const perkCmds = {
  rob: `\`${prefix} rob <@user>\` — 50/50 robbery`,
  profile: `\`${prefix} profile\` — view stats`,
  rain: `\`${prefix} rain <amount>\` — rain money to all`,
  duel: `\`${prefix} duel <@user> <amount>\` — 1v1 challenge`,
  rep: `\`${prefix} rep <@user>\` — give reputation`,
};

module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'cmds'],
  execute(message, args) {
    const uid = message.author.id;
    const owned = db.getUserPerks(uid).map(p => p.perk);
    const perkLines = Object.entries(perkCmds).filter(([k]) => owned.includes(k)).map(([, v]) => v);

    const sections = [
      ['Economy', [
        `\`${prefix} bal\` — check balance`,
        `\`${prefix} bank\` — deposit/withdraw/loans`,
        `\`${prefix} daily\` — daily reward`,
        `\`${prefix} weekly\` — weekly reward`,
        `\`${prefix} work\` — earn money`,
        `\`${prefix} give <@user> <amount>\` — send money`,
        `\`${prefix} lb\` — leaderboard`,
      ].join('\n')],
      ['Games', [
        `\`${prefix} cf <amount> <heads/tails>\` — coinflip`,
        `\`${prefix} slots <amount>\` — slot machine`,
        `\`${prefix} dice <amount> <over/under> <num>\` — dice`,
        `\`${prefix} roulette <amount> <red/black/green/num>\` — roulette`,
        `\`${prefix} bj <amount>\` — blackjack`,
        `\`${prefix} mines <amount>\` — mines`,
        `\`${prefix} crash <amount> <multiplier>\` — crash`,
        `\`${prefix} lottery buy <amount>\` — lottery`,
        `\`${prefix} gamehelp <game>\` — rules & tips`,
      ].join('\n')],
      ['Pets', [
        `\`${prefix} hunt\` — hunt for animals`,
        `\`${prefix} zoo\` — view your animals`,
        `\`${prefix} team <slot> <id>\` — set battle team`,
        `\`${prefix} battle <@user>\` — battle pets`,
        `\`${prefix} sell <id>\` — sell an animal`,
        `\`${prefix} rename <id> <name>\` — rename pet`,
      ].join('\n')],
      ['Social', [
        `\`${prefix} marry <@user>\` — propose marriage`,
        `\`${prefix} divorce\` — divorce`,
        `\`${prefix} adopt <@user>\` — adopt a child`,
      ].join('\n')],
      ['Shop', [
        `\`${prefix} shop\` — browse the shop`,
        `\`${prefix} autoreact <emoji>\` — auto-react emoji`,
        `\`${prefix} customrole name | #color\` — set custom role`,
        `\`${prefix} deleterole\` — delete custom role`,
        `\`${prefix} setbadge <emoji>\` — badge on profile`,
        `\`${prefix} setlb <emoji>\` — leaderboard emoji`,
      ].join('\n')],
    ];

    if (perkLines.length) {
      sections.push(['Your Perk Commands', perkLines.join('\n')]);
    }

    message.channel.send({
      embeds: [embed('🎰 Gambot', sections)],
    });
  },
};
