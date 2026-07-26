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
        } else if (raw.startsWith('lucky') || raw.startsWith('luck')) {
          const tokens = raw.split(/\s+/);
          cmdName = 'ovo';
          args = ['lucky', ...tokens.slice(1)];
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

  if (prefix === 'A') {
    if (message.author.id !== config.ownerId) return;
    try { cmd.execute(message, args); } catch (err) {
      console.error(`Admin error:`, err);
      message.channel.send({ embeds: [require('./embed').error('admin error')] });
    }
    return;
  }

  if (message.guild && db.isCommandDisabled(message.guild.id, cmd.name)) {
    return;
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
      logger.logCmd(message.guild?.id, `Command Error: ${cmdName}`, [['User', `${message.author}`], ['Error', err.message]], 0xed4245);
    });
    logger.logCmd(message.guild?.id, `Command: ${cmdName}`, [
      ['User', `${message.author}`],
      ['Args', args.join(' ') || '-'],
      ['Channel', `${message.channel}`],
    ], 0x2b2d31);
    } catch (err) {
      console.error(`Error in command ${cmdName}:`, err);
      message.channel.send({ embeds: [require('./embed').error('an error occurred')] });
      logger.logCmd(message.guild?.id, `Command Error: ${cmdName}`, [
        ['User', `${message.author}`],
        ['Error', err.message],
      ], 0xed4245);
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
