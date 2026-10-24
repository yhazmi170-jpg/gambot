const { EmbedBuilder } = require('discord.js');

const FIELD_VALUE_LIMIT = 1024;

function embed(title, fields = [], color = 0x2b2d31) {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(title);
  for (const [name, value, inline = false] of fields) {
    if (value === undefined || value === null) continue;
    const str = String(value);
    if (str.length <= FIELD_VALUE_LIMIT) {
      e.addFields({ name, value: str, inline });
    } else {
      chunkText(str).forEach((c, i) =>
        e.addFields({ name: i === 0 ? name : `${name} (cont.)`, value: c, inline: false }));
    }
  }
  return e;
}

function error(msg) {
  return embed('Error', [['message', msg]], 0xed4245);
}

function success(msg) {
  return embed('Success', [['message', msg]], 0x57f287);
}

function chunkText(text, limit = FIELD_VALUE_LIMIT) {
  const str = String(text || '');
  if (!str) return [''];
  const chunks = [];
  let rest = str;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < 1) cut = limit;
    chunks.push(rest.slice(0, cut).replace(/\n+$/, ''));
    rest = rest.slice(cut).replace(/^\n+/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function updateEmbed(ver, msg, uptime, color = 0x5865f2) {
  const e = embed('📢 Bot Update', [], color);
  e.addFields({ name: 'Version', value: String(ver) });
  const chunks = chunkText(msg);
  chunks.forEach((c, i) => e.addFields({ name: i === 0 ? 'What\'s New' : 'What\'s New (cont.)', value: c }));
  e.addFields({ name: 'Uptime', value: String(uptime) });
  return e;
}

function parseAmount(str) {
  if (!str || typeof str !== 'string') return NaN;
  const lower = str.toLowerCase().replace(/,/g, '');
  const match = lower.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!match) return parseInt(lower);
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === 'k') return Math.floor(num * 1000);
  if (suffix === 'm') return Math.floor(num * 1000000);
  if (suffix === 'b') return Math.floor(num * 1000000000);
  return Math.floor(num);
}

function progressBar(current, max, length = 10) {
  if (max <= 0) return '▱'.repeat(length);
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

function card(opts = {}) {
  const e = new EmbedBuilder();
  if (opts.color !== undefined) e.setColor(opts.color);
  else e.setColor(0x5865f2);
  if (opts.title) e.setTitle(opts.title);
  if (opts.url) e.setURL(opts.url);
  if (opts.author) {
    if (typeof opts.author === 'string') e.setAuthor({ name: opts.author });
    else e.setAuthor(opts.author);
  }
  if (opts.description) e.setDescription(opts.description);
  if (opts.thumbnail) e.setThumbnail(opts.thumbnail);
  if (opts.image) e.setImage(opts.image);
  if (opts.footer) {
    if (typeof opts.footer === 'string') e.setFooter({ text: opts.footer });
    else e.setFooter(opts.footer);
  }
  if (opts.timestamp) e.setTimestamp(opts.timestamp === true ? new Date() : opts.timestamp);
  if (Array.isArray(opts.fields)) {
    for (const f of opts.fields) {
      if (!f) continue;
      const [name, value, inline = false] = Array.isArray(f) ? f : [f.name, f.value, f.inline];
      if (value === undefined || value === null) continue;
      const str = String(value);
      if (str.length <= FIELD_VALUE_LIMIT) {
        e.addFields({ name: String(name), value: str, inline: !!inline });
      } else {
        chunkText(str).forEach((c, i) =>
          e.addFields({ name: i === 0 ? String(name) : `${name} (cont.)`, value: c, inline: false }));
      }
    }
  }
  return e;
}

module.exports = { embed, error, success, parseAmount, chunkText, updateEmbed, progressBar, card };
