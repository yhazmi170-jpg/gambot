const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { version } = require('../package.json');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require('discord.js');

const prefix = config.prefixes[0];

const perkCmdMap = {
  rob: `\`${prefix} rob <@user>\` — 30% chance to steal 20% (max 3M) / 70% chance you lose 20% (max 3M) + 30m jail + insurance downgrade`,
  rain: `\`${prefix} rain <amount>\` — rain money to online members`,
  duel: `\`${prefix} duel <@user> <amount>\` — 1v1 coinflip (capped at 100,000,000 per duel)`,
  rep: `\`${prefix} rep <@user>\` — give reputation`,
};

const CATEGORY_ORDER = ['Economy', 'Games', 'Pets', 'Shop', 'Social', 'Fun', 'Profile', 'Info', 'Admin'];

function loadCategories() {
  const cmdsByCat = {};
  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'help.js');
  for (const file of files) {
    delete require.cache[require.resolve(path.join(dir, file))];
    const cmd = require(path.join(dir, file));
    if (cmd.helpCategory) {
      const cat = cmd.helpCategory === 'Perks' ? 'Shop' : cmd.helpCategory;
      if (!cmdsByCat[cat]) cmdsByCat[cat] = [];
      cmdsByCat[cat].push({
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

function buildMenuContainer(uid) {
  const owned = uid ? db.getUserPerks(uid).map(p => p.perk) : [];
  const cats = loadCategories();

  const lines = [
    `### Gambot Help`,
    `-# Prefix: \`${prefix}\` · Version: \`v${version}\``,
    '',
    'Pick a category to view commands.',
  ];

  const buttons = cats.map(([cat], i) =>
    new ButtonBuilder().setCustomId(`help_cat_${i}`).setLabel(cat).setStyle(ButtonStyle.Secondary)
  );

  const perksLabel = owned.length > 0 ? `Perks (${owned.length})` : 'Perks';
  buttons.push(new ButtonBuilder().setCustomId('help_perks').setLabel(perksLabel).setStyle(ButtonStyle.Secondary));

  const rows = [];
  let row = [];
  for (const b of buttons) {
    row.push(b);
    if (row.length === 5) {
      rows.push(new ActionRowBuilder().addComponents(row));
      row = [];
    }
  }
  if (row.length) rows.push(new ActionRowBuilder().addComponents(row));

  const container = new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

  for (const r of rows) {
    container.addActionRowComponents(r);
  }

  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  };
}

function buildCategoryContainer(cat) {
  const catName = cat[0];
  const cmdLines = cat[1];

  const header = `### Help — ${catName}\n-# Prefix: \`${prefix}\` · ${cmdLines.length} commands\n`;

  const textChunks = [];
  let cur = header;
  for (const line of cmdLines) {
    if (cur.length + line.length + 1 > 3800) {
      textChunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) textChunks.push(cur);

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
  );

  const container = new ContainerBuilder().setAccentColor(0x2b2d31);
  for (const chunk of textChunks) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
  }
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
  container.addActionRowComponents(backRow);

  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  };
}

function buildPerksContainer(uid) {
  const owned = uid ? db.getUserPerks(uid).map(p => p.perk) : [];
  const { allShopItems } = require('./shop');
  const items = allShopItems();
  const shopMap = Object.fromEntries(items.map(i => [i.id, i]));
  const lines = [];
  for (const id of owned) {
    const it = shopMap[id];
    if (it) {
      lines.push(`**${it.name}** — ${it.desc}\n${it.use}${it.monthly ? ' (monthly)' : ''}`);
    } else {
      const c = perkCmdMap[id];
      if (c) lines.push(`**${id}**\n${c}`);
      else lines.push(`**${id}**`);
    }
  }
  if (!lines.length) lines.push('No perks owned yet. Buy perks in `v shop`.');

  const header = `### Help — Perks\n-# ${owned.length} owned\n`;
  const textChunks = [];
  let cur = header;
  for (const line of lines) {
    if (cur.length + line.length + 1 > 3800) {
      textChunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) textChunks.push(cur);

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
  );

  const container = new ContainerBuilder().setAccentColor(0x2b2d31);
  for (const chunk of textChunks) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
  }
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
  container.addActionRowComponents(backRow);

  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  };
}

async function handleInteraction(i) {
  try {
    if (!i.customId.startsWith('help_')) return;
    if (i.customId === 'help_perks') {
      await i.update(buildPerksContainer(i.user.id));
      return;
    }
    if (i.customId === 'help_back') {
      await i.update(buildMenuContainer(i.user.id));
      return;
    }
    if (i.customId.startsWith('help_cat_')) {
      const idx = parseInt(i.customId.replace('help_cat_', ''), 10);
      const cats = loadCategories();
      if (isNaN(idx) || !cats[idx]) return;
      await i.update(buildCategoryContainer(cats[idx]));
    }
  } catch (e) {
    console.error('help interaction err:', e);
  }
}

module.exports = {
  name: 'help',
  aliases: ['commands', 'cmds'],
  handleInteraction,
  execute(message, args) {
    const uid = message.author.id;
    if (args && args.length) {
      const query = args[0].toLowerCase();
      const cats = loadCategories();
      const matchedCat = cats.find(([c]) => c.toLowerCase() === query);
      if (matchedCat) {
        return message.channel.send(buildCategoryContainer(matchedCat));
      }
      const dir = path.join(__dirname);
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'help.js');
      for (const file of files) {
        const cmd = require(path.join(dir, file));
        if (cmd.name === query || (cmd.aliases && cmd.aliases.includes(query))) {
          const container = new ContainerBuilder()
            .setAccentColor(0x2b2d31)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `### \`${prefix} ${cmd.name}${cmd.helpArgs ? ' ' + cmd.helpArgs : ''}\`\n${cmd.description || cmd.name}`
            ));
          return message.channel.send({ components: [container], flags: [MessageFlags.IsComponentsV2] });
        }
      }
    }

    const payload = buildMenuContainer(uid);
    message.channel.send(payload).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, uid);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
    });
  },
};
