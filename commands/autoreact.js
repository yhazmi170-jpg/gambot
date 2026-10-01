const db = require('../db');
const { embed, error, success } = require('../utils/embed');

module.exports = {
  name: 'autoreact',
  helpCategory: 'Shop',
  helpArgs: '[emoji] [emoji] [emoji]',
  description: 'set auto-react emojis (requires perk) — up to 4 if you bought the slot upgrades',
  aliases: ['ar', 'autoreaction'],
  execute(message, args) {
    if (!db.hasPerk(message.author.id, 'auto_react')) {
      return message.channel.send({ embeds: [error("you don't own the auto-react perk. buy it from the shop.")] });
    }
    const slots = db.autoReactSlots(message.author.id);
    const raw = args.join(' ').trim();
    const lower = raw.toLowerCase();

    if (!raw) {
      const cur = db.getAutoReactEmojis(message.author.id);
      const list = cur.length ? cur.join('  ') : 'none';
      const more = slots > 1 ? `\nsold: **${cur.length}/${slots}** emoji${slots > 1 ? 's' : ''} — buy more slots in the shop` : '';
      return message.channel.send({ embeds: [cur.length
        ? success(`auto-react: ${list} — change with \`v autoreact <emoji> <emoji>\`, clear with \`v autoreact remove\``)
        : error(`no auto-react set — usage: \`v autoreact <emoji>\`${more}`)] });
    }
    if (lower === 'remove' || lower === 'off' || lower === 'clear' || lower === 'none') {
      db.clearAutoReactEmoji(message.author.id);
      return message.channel.send({ embeds: [success('auto-react removed — no more auto-reactions')] });
    }

    // split on whitespace and/or commas so `v ar ☠️ 🔥` and `v ar ☠️,🔥` both work
    const picked = raw.split(/[\s,]+/).map(e => e.trim()).filter(Boolean);
    const unique = [...new Set(picked)];
    if (unique.length > slots) {
      return message.channel.send({ embeds: [error(
        `you can only set **${slots}** emoji${slots > 1 ? 's' : ''} (you gave ${unique.length}). `
        + (slots < 4 ? `buy the next slot in the shop to use more.` : `that is the max.`),
      )] });
    }
    db.setAutoReactEmoji(message.author.id, unique);
    return message.channel.send({ embeds: [success(`auto-react emoji${unique.length > 1 ? 's' : ''} set to ${unique.join(' ')}`)] });
  },
};