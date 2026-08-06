const fs = require('fs');
const path = require('path');
const db = require('../db');
const { embed } = require('../utils/embed');
const config = require('../config');
const { version } = require('../package.json');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const prefix = config.prefixes[0];

const perkCmdMap = {
  rob: `\`${prefix} rob <@user>\` — 50/50 robbery`,
  profile: `\`${prefix} profile\` — view stats`,
  rain: `\`${prefix} rain <amount>\` — rain money to online members`,
  duel: `\`${prefix} duel <@user> <amount>\` — 1v1 coinflip`,
  rep: `\`${prefix} rep <@user>\` — give reputation`,
  vip_games: `\`${prefix} poker <amount>\` — video poker (VIP)`,
};

const CATEGORY_ORDER = ['Economy', 'Games', 'Pets', 'Social', 'Shop'];

// Discord caps a single embed field at 1024 chars — chunk long lists across fields.
function chunkFields(name, lines) {
  const fields = [];
  let cur = '';
  for (const line of lines) {
    if (cur.length + line.length + 1 > 1024) {
      fields.push([name, cur]);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) fields.push([name, cur]);
  return fields;
}

function loadCategories() {
  const cmdsByCat = {};
  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'help.js');
  for (const file of files) {
    delete require.cache[require.resolve(path.join(dir, file))];
    const cmd = require(path.join(dir, file));
    if (cmd.helpCategory) {
      if (!cmdsByCat[cmd.helpCategory]) cmdsByCat[cmd.helpCategory] = [];
      cmdsByCat[cmd.helpCategory].push({
        name: cmd.name,
        line: `\`${prefix} ${cmd.name}${cmd.helpArgs ? ' ' + cmd.helpArgs : ''}\` — ${cmd.description || cmd.name}`,
      });
    }
  }

  const cats = [];
  for (const cat of CATEGORY_ORDER) {
    if (!cmdsByCat[cat]) continue;
    cats.push([cat, cmdsByCat[cat].sort((a, b) => a.name.localeCompare(b.name)).map(c => c.line)]);
  }
  for (const cat of Object.keys(cmdsByCat)) {
    if (CATEGORY_ORDER.includes(cat)) continue;
    cats.push([cat, cmdsByCat[cat].sort((a, b) => a.name.localeCompare(b.name)).map(c => c.line)]);
  }
  return cats;
}

function buildMenuEmbed(uid) {
  const owned = db.getUserPerks(uid).map(p => p.perk);
  const cats = loadCategories();
  const lines = cats.map(([cat], i) => `**${i + 1}. ${cat}**`).join('\n');
  const hasPerks = Object.keys(perkCmdMap).some(k => owned.includes(k));
  const tips = [
    `\`${prefix} gamehelp <game>\` — rules for each game`,
    `\`${prefix} version\` — bot version (v${version})`,
    'Higher balance = slightly lower rewards/wins (caps at 30% less)',
  ];
  return new EmbedBuilder().setColor(0x2b2d31)
    .setTitle(`Gambot v${version}`)
    .setDescription(`pick a category to see its commands${hasPerks ? '\n**Your Perk Commands** — commands you own' : ''}\n\n${lines}\n\n${tips.join(' · ')}`);
}

function buildMenuRow(uid) {
  const owned = db.getUserPerks(uid).map(p => p.perk);
  const cats = loadCategories();
  const buttons = cats.map(([cat], i) =>
    new ButtonBuilder().setCustomId(`help_cat_${i}`).setLabel(cat).setStyle(ButtonStyle.Secondary));
  const rows = [];
  let row = [];
  for (const b of buttons) {
    row.push(b);
    if (row.length === 5) { rows.push(new ActionRowBuilder().addComponents(row)); row = []; }
  }
  const hasPerks = Object.keys(perkCmdMap).some(k => owned.includes(k));
  if (row.length || hasPerks) {
    if (hasPerks) row.push(new ButtonBuilder().setCustomId('help_perks').setLabel('Your Perks').setStyle(ButtonStyle.Secondary));
    if (row.length) rows.push(new ActionRowBuilder().addComponents(row));
  }
  return rows;
}

function buildCategoryEmbed(cat) {
  const fields = chunkFields(cat[0], cat[1]);
  return embed(`Help — ${cat[0]}`, fields, 0x2b2d31);
}

function buildCategoryRows() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help_back').setLabel('◀ Back').setStyle(ButtonStyle.Secondary),
  )];
}

function buildPerksEmbed(uid) {
  const owned = db.getUserPerks(uid).map(p => p.perk);
  const lines = Object.entries(perkCmdMap).filter(([k]) => owned.includes(k)).map(([, v]) => v);
  const fields = chunkFields('Your Perk Commands', lines);
  return embed(`Your Perk Commands`, fields, 0x2b2d31);
}

async function handleInteraction(i) {
  try {
    if (!i.customId.startsWith('help_')) return;
    if (i.customId === 'help_perks') {
      await i.update({ embeds: [buildPerksEmbed(i.user.id)], components: buildCategoryRows() });
      return;
    }
    if (i.customId === 'help_back') {
      await i.update({ embeds: [buildMenuEmbed(i.user.id)], components: buildMenuRow(i.user.id) });
      return;
    }
    if (i.customId.startsWith('help_cat_')) {
      const idx = parseInt(i.customId.replace('help_cat_', ''), 10);
      const cats = loadCategories();
      if (isNaN(idx) || !cats[idx]) return;
      await i.update({ embeds: [buildCategoryEmbed(cats[idx])], components: buildCategoryRows() });
    }
  } catch (e) { console.error('help interaction err:', e); }
}

module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'cmds'],
  handleInteraction,
  execute(message) {
    const uid = message.author.id;
    message.channel.send({ embeds: [buildMenuEmbed(uid)], components: buildMenuRow(uid) });
  },
};
