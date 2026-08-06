const { EmbedBuilder } = require('discord.js');

let sponsoredName = null;
function setSponsored(name) { sponsoredName = name; }
function getSponsored() { return sponsoredName; }

function embed(title, fields = [], color = 0x2b2d31) {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(title);
  for (const [name, value, inline = false] of fields) {
    if (value !== undefined && value !== null) e.addFields({ name, value: String(value), inline });
  }
  if (sponsoredName) e.setFooter({ text: `Sponsored by @${sponsoredName}` });
  return e;
}

function error(msg) {
  return embed('Error', [['message', msg]], 0xed4245);
}

function success(msg) {
  return embed('Success', [['message', msg]], 0x57f287);
}

const FIELD_VALUE_LIMIT = 1024;
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

module.exports = { embed, error, success, parseAmount, setSponsored, getSponsored };
