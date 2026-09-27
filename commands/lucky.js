const db = require('../db');
const { embed, error } = require('../utils/embed');

// Owner ID for Gambot
const OWNER_ID = '536278876247162882';

function luckyListEmbed() {
  const luckyIds = db.getLuckyUsers();
  const all = (db.getAllUsers ? db.getAllUsers() : []) || [];
  const lines = luckyIds.length
    ? luckyIds.map(id => `<@${id}>`)
    : ['nobody — grant it with `Alucky @user`'];
  return embed('🍀 Godlike Luck', [
    ['Lucky', lines.join('\n')],
    ['Not lucky', `everyone else (${all.length - luckyIds.length} / ${all.length} users)`],
    ['Effect', `granted users get **${db.LUCKY_WIN_MULT}x** on every gambling win with no balance cut — ` +
      'toggle a user with `Alucky @user` (owner only)'],
  ], 0xffd700);
}

module.exports = {
  name: 'luckylist',
  helpCategory: 'Admin',
  helpArgs: '[@user]',
  description: 'owner-only: grant/remove godlike luck (5x gambling wins), or list who has it',
  aliases: ['lucky', 'alucky'],
  execute(message, args) {
    const authorId = message.author.id;

    // Only owner can view or toggle lucky
    if (authorId !== OWNER_ID) {
      return message.channel.send({ embeds: [error('this command is reserved for the bot owner.')] });
    }

    // Resolve target mention (or raw id in the first arg)
    let targetId = null;
    const mention = message.mentions && message.mentions.users && message.mentions.users.first();
    if (mention) targetId = mention.id;
    else if (args[1] || args[0]) {
      const raw = String(args[1] || args[0]);
      if (/^\d+$/.test(raw)) targetId = raw;
    }

    // No target / "list" -> show who's lucky and who isn't
    if (!targetId || (args[0] || '').toLowerCase() === 'list') {
      return message.channel.send({ embeds: [luckyListEmbed()] });
    }

    const on = db.toggleGodLuck(targetId);
    return message.channel.send({ embeds: [embed('🍀 Godlike Luck', [
      ['', `<@${targetId}> ${on ? 'now has **godlike luck** — 5x wins, no balance cut' : 'lost their luck — wins are back to normal. 🌟'}`],
      ['', 'run `Alucky` to see the full list'],
    ], on ? 0xffd700 : 0x5865f2)] });
  },
};