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

async function handleMessage(message) {
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

  const dlog = require('../debuglog');
  dlog.log({ kind: 'parsed', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, raw: message.content.slice(0, 40) });

  const trace = step => dlog.log({ kind: 'step', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step });

  try { db.catchUpAutohunt(message.author.id); } catch (err) { dlog.log({ kind: 'throw', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'catchUpAutohunt', err: err && err.message }); }
  try { db.breedSnails(message.author.id); } catch (err) { dlog.log({ kind: 'throw', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'breedSnails', err: err && err.message }); }

  if (prefix === 'A') {
    if (message.author.id !== config.ownerId) return;
    try { cmd.execute(message, args); } catch (err) {
      console.error(`Admin error:`, err);
      message.channel.send({ embeds: [require('./embed').error('admin error')] });
    }
    return;
  }

  const ALWAYS_ALLOWED = ['help', 'enable', 'disable'];
  try {
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
  } catch (err) {
    console.error('disabled-check error:', err);
  }

  if (!COMMANDS_BEFORE_TOS.includes(cmd.name) && !COMMANDS_BEFORE_TOS.includes(cmdName)) {
    if (!db.isRegistered(message.author.id)) {
      dlog.log({ kind: 'step', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'tos_prompt_sent' });
      try {
        await sendTosPrompt(message, () => {
          cmd.execute(message, args);
        });
      } catch (err) {
        dlog.log({ kind: 'throw', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'sendTosPrompt', err: err && err.message });
        console.error(`TOS prompt failed for ${message.author.id}:`, err && err.message);
      }
      return;
    }
  }

  const cd = checkCooldown(message.author.id, cmd.name);
  dlog.log({ kind: 'step', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'cooldown_ok' });
  if (cd > 0) {
    dlog.log({ kind: 'step', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'cooldown_blocked_' + cd });
    return message.channel.send({ embeds: [error(`wait **${cd}s** before using that again`)] });
  }

  // Guild summon rate limit: prevent repeated summons within 24h
  const guild = db.getGuild(message.guild.id);
  const guildSummonLast = guild.summon_last || 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const twentyFourHours = 24 * 86400;
  const summonBlocked = guildSummonLast && nowSec - guildSummonLast < twentyFourHours;
  
  if (summonBlocked) {
    const remaining = Math.ceil((twentyFourHours - (nowSec - guildSummonLast)) / 60);
    return message.channel.send({ embeds: [error(`Summons are limited to once per 24h. Try again in **${remaining}** minutes.`)] });
  }
  
  // Update last summon time after a successful summon (handled in summon.js)
  

  try { u = db.ensureUser(message.author.id); } catch (err) {
    dlog.log({ kind: 'throw', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'ensureUser', err: err && err.message });
    console.error('ensureUser error:', err);
    return message.channel.send({ embeds: [error('an error occurred')] }).catch(() => {});
  }
  // Inactivity-based summon eligibility
  db.setSummonTime(message.author.id);
  
  // Check if >=7 days since last meaningful command
  const lastMeaningful = getLastMeaningfulAt(message.author.id);
  const nowSec = Math.floor(Date.now() / 1000);
  let eligible = false;
  let summonTriggered = false;
  if (lastMeaningful && nowSec - lastMeaningful >= 7 * 86400) {
    eligible = true;
    // Low probability trigger (1 in 7 chance per week of inactivity)
    if (Math.random() < 1 / 7) {
      summonTriggered = true;
    }
  }
  
  // If eligible and not opt-out, attempt summon
  if (eligible && !db.getSummonOptOut(message.author.id)) {
    // Check if 14-day cooldown has passed since last successful summon
    const lastSummon = getLastSummonAt(message.author.id);
    if (!lastSummon || nowSec - lastSummon >= 14 * 86400) {
      // Attempt successful summon - record the time
      db.upsertActivity(message.author.id, 'last_summon_at', nowSec);
      summonTriggered = true;
    }
  }
  
  if (summonTriggered) {
    // The summon nudge will be delivered on the next command
    // failed delivery does NOT consume the cooldown
  }  dlog.log({ kind: 'step', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'pre_execute' });

  try {
    const result = cmd.execute(message, args);
    dlog.log({ kind: 'executed', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name });
    if (result instanceof Promise) result.catch(err => {
      dlog.log({ kind: 'throw', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'execute_promise', err: err && err.message });
      console.error(`Error in command ${cmdName}:`, err);
      message.channel.send({ embeds: [error(err.message.slice(0, 100))] }).catch(() => {});
    });
    } catch (err) {
      dlog.log({ kind: 'throw', guild: message.guild && message.guild.id, user: message.author.id, cmd: cmd.name, step: 'execute_sync', err: err && err.message });
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

  // lightweight feature usage + activity signal (powers v try, summons, tips).
  // stores command NAME only — never arguments or message content.
  try {
    db.recordFeatureUse(message.author.id, cmd.name);
    db.recordActivity(message.author.id, db.CLAIM_ONLY_COMMANDS.includes(cmd.name) ? 'claim' : 'meaningful');
  } catch (err) {
    console.error('usage tracking error:', err);
  }

  try {
    const unlocked = db.checkAchievements(message.author.id);
    if (unlocked.length) {
      const fields = unlocked.map(ach => {
        if (ach.rewardType === 'title') return [ach.name, `${ach.desc}\n+🎖️ **${db.TITLES[ach.titleKey || ach.key] ? db.TITLES[ach.titleKey || ach.key].name : 'title'}** unlocked`];
        if (ach.rewardType === 'none') return [ach.name, `${ach.desc}`];
        return [ach.name, `${ach.desc}\n+**${ach.reward.toLocaleString()}** ${config.currency}`];
      });
      message.channel.send({ embeds: [require('./embed').embed('🏅 Achievements Unlocked!', fields, 0xf1c40f)] }).catch(() => {});
      if (message.guild) {
        try {
          for (const ach of unlocked) db.addIncident(message.guild.id, 'achievement', `<@${message.author.id}> unlocked ${ach.name.replace(/[^\w ]+/g, '').trim() || 'an achievement'}`);
        } catch (err) { console.error('incident achievement error:', err); }
      }
    }
  } catch (err) {
    console.error('checkAchievements error:', err);
  }

  try {
    const unlockedTitles = db.checkTitles(message.author.id);
    if (unlockedTitles.length) {
      const fields = unlockedTitles.map(key => [db.TITLES[key].name, db.TITLES[key].desc]);
      message.channel.send({ embeds: [require('./embed').embed('🎖️ Title Unlocked!', fields, 0x57f287)] }).catch(() => {});
      if (message.guild) {
        try {
          for (const key of unlockedTitles) db.addIncident(message.guild.id, 'title', `<@${message.author.id}> claimed the title "${db.TITLES[key].name}"`);
        } catch (err) { console.error('incident title error:', err); }
      }
    }
  } catch (err) {
    console.error('checkTitles error:', err);
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

  const dlog = require('../debuglog');
  col.on('collect', async (interaction) => {
    // Ack immediately so a slow event loop (sql.js save / backup) can never make
    // the click look like it timed out before we accept the terms.
    await interaction.deferUpdate().catch(() => {});
    try {
      db.acceptTerms(message.author.id);
    } catch (err) {
      dlog.log({ kind: 'step', guild: message.guild && message.guild.id, user: message.author.id, cmd: 'agree', step: 'tos_accept_failed', err: err && err.message });
      console.error(`[TOS] acceptTerms failed for ${message.author.id}:`, (err && err.message) || err);
      return msg.channel.send({ embeds: [error('could not accept terms right now — try again in a second')] }).catch(() => {});
    }
    dlog.log({ kind: 'step', guild: message.guild && message.guild.id, user: message.author.id, cmd: 'agree', step: 'tos_accepted' });
    await msg.edit({
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
