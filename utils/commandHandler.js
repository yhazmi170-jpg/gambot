const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const db = require('../db');
const { embed, error } = require('./embed');
const { checkCooldown } = require('./cooldowns');
const logger = require('./logger');

const commands = new Map();
const aliases = new Map();

const COMMANDS_BEFORE_TOS = ['help', 'agree', 'disable', 'enable'];

function loadCommands() {
  const dir = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(dir, file));
    commands.set(cmd.name, cmd);
    if (cmd.aliases) {
      for (const a of cmd.aliases) {
        aliases.set(a, cmd.name);
      }
    }
  }
}

function getCommand(name) {
  const lower = name.toLowerCase();
  if (commands.has(lower)) return commands.get(lower);
  if (aliases.has(lower)) return commands.get(aliases.get(lower));
  return null;
}

function handleMessage(message) {
  if (message.author.bot) return;

  const content = message.content.trim();
  let prefix = null;
  let cmdName = null;
  let args = [];
  let rest = '';

  for (const p of config.prefixes) {
    if (p === 'A') {
      if (content.startsWith('A') && content.length > 1 && content[1] !== ' ') {
        let raw = content.slice(1).trim();
        if (raw.startsWith('R')) {
          const afterR = raw.slice(1).trim();
          const tokens = afterR.split(/\s+/);
          cmdName = tokens[0];
          args = ['remove', ...tokens.slice(1)];
        } else if (raw.startsWith('r')) {
          const afterR = raw.slice(1).trim();
          const tokens = afterR.split(/\s+/);
          if (tokens[0] === 'estart' || tokens[0] === '') {
            cmdName = 'ovo';
            args = ['restart'];
          } else {
            const tokens2 = raw.split(/\s+/);
            cmdName = tokens2[0];
            args = tokens2.slice(1);
          }
        } else if (raw.startsWith('lucky') || raw.startsWith('luck')) {
          const tokens = raw.split(/\s+/);
          cmdName = 'ovo';
          args = ['lucky', ...tokens.slice(1)];
        } else if (raw.startsWith('cmds')) {
          cmdName = 'ovo';
          args = ['cmds'];
        } else {
          const tokens = raw.split(/\s+/);
          cmdName = tokens[0];
          args = tokens.slice(1);
        }
        prefix = 'A';
        break;
      }
    } else if (content.toLowerCase().startsWith(p.toLowerCase() + ' ')) {
      prefix = p;
      rest = content.slice(p.length).trim();
      const parts = rest.split(/\s+/);
      cmdName = parts[0];
      args = parts.slice(1);
      break;
    }
  }

  if (!cmdName) return;

  const cmd = getCommand(cmdName);
  if (!cmd) return;

  try { db.catchUpAutohunt(message.author.id); } catch (err) {}
  try { db.breedSnails(message.author.id); } catch (err) {}

  if (prefix === 'A') {
    if (message.author.id !== config.ownerId) return;
    try { cmd.execute(message, args); } catch (err) {
      console.error(`Admin error:`, err);
      message.channel.send({ embeds: [require('./embed').error('admin error')] });
    }
    return;
  }

  const ALWAYS_ALLOWED = ['help', 'enable', 'disable'];
  if (message.guild && !ALWAYS_ALLOWED.includes(cmd.name) && message.author.id !== config.ownerId) {
    const guild = db.getGuild(message.guild.id);
    const guildDisabled = guild.disabled_commands.includes('all') || guild.disabled_commands.includes(cmd.name);
    const channelRows = db.exec(`SELECT commands FROM channel_disabled WHERE guild_id = '${message.guild.id}' AND channel_id = '${message.channel.id}'`);
    const channelList = (channelRows.length && channelRows[0].values.length) ? JSON.parse(channelRows[0].values[0][0] || '[]') : [];
    const channelDisabled = channelList.includes('all') || channelList.includes(cmd.name);
    if (guildDisabled || channelDisabled) {
      const where = guildDisabled ? 'this server' : 'this channel';
      message.channel.send({ embeds: [error(`\`${cmd.name}\` is disabled in ${where}`)] }).then(m => setTimeout(() => m.delete().catch(() => {}), 4000)).catch(() => {});
      return;
    }
  }

  if (!COMMANDS_BEFORE_TOS.includes(cmd.name) && !COMMANDS_BEFORE_TOS.includes(cmdName)) {
    if (!db.isRegistered(message.author.id)) {
      sendTosPrompt(message, () => {
        cmd.execute(message, args);
      });
      return;
    }
  }

  const cd = checkCooldown(message.author.id, cmd.name);
  if (cd > 0) {
    return message.channel.send({ embeds: [error(`wait **${cd}s** before using that again`)] });
  }

  try {
    const result = cmd.execute(message, args);
    if (result instanceof Promise) result.catch(err => {
      console.error(`Error in command ${cmdName}:`, err);
      message.channel.send({ embeds: [error(err.message.slice(0, 100))] }).catch(() => {});
    });
    } catch (err) {
      console.error(`Error in command ${cmdName}:`, err);
      message.channel.send({ embeds: [require('./embed').error('an error occurred')] });
    }

  try {
    const lvl = db.grantXp(message.author.id, 25);
    if (lvl && lvl.leveledUp) {
      message.channel.send({ content: `<@${message.author.id}>`, embeds: [require('./embed').embed('⬆️ Level Up!', [['', `you hit **level ${lvl.newLevel}** and got **${lvl.reward.toLocaleString()}** money!`]], 0x57f287)] }).catch(() => {});
    }
  } catch (err) {
    console.error('grantXp error:', err);
  }

  try {
    const unlocked = db.checkAchievements(message.author.id);
    if (unlocked.length) {
      const fields = unlocked.map(ach => [ach.name, `${ach.desc}\n+**${ach.reward.toLocaleString()}** ${config.currency}`]);
      message.channel.send({ embeds: [require('./embed').embed('🏅 Achievements Unlocked!', fields, 0xf1c40f)] }).catch(() => {});
    }
  } catch (err) {
    console.error('checkAchievements error:', err);
  }
}

async function sendTosPrompt(message, onAccept) {
  const acceptBtn = new ButtonBuilder()
    .setCustomId('tos_accept')
    .setLabel('I Agree')
    .setStyle(ButtonStyle.Success);
  const row = new ActionRowBuilder().addComponents(acceptBtn);

  const msg = await message.channel.send({
    embeds: [embed('📋 Terms of Service', [
      ['Welcome', 'by using this bot you agree to:'],
      ['Rules', 'no abuse of bugs, no spam, no harassment'],
      ['Risks', 'gambling is virtual only — no real money involved'],
      ['Data', 'we store your user ID and game stats for leaderboards'],
      ['', `click **I Agree** to get **${db.START_BALANCE}** money and start playing`],
    ], 0x5865f2)],
    components: [row],
  });

  const filter = i => i.user.id === message.author.id && i.customId === 'tos_accept';
  const col = msg.createMessageComponentCollector({ filter, time: 60000, max: 1 });

  col.on('collect', async (interaction) => {
    await interaction.deferUpdate().catch(() => {});
    db.acceptTerms(message.author.id);
    msg.edit({
      embeds: [embed('✅ Terms Accepted', [
        ['', `you got **${db.START_BALANCE}** money to start!`],
      ], 0x57f287)],
      components: [],
    }).catch(() => {});
    if (onAccept) onAccept();
  });

  col.on('end', async (collected) => {
    if (!collected.size) {
      await msg.edit({ components: [] }).catch(() => {});
    }
  });
}

module.exports = { loadCommands, getCommand, handleMessage };
