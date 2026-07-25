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
