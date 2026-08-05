const db = require('../db');
const { embed, error, success, parseAmount } = require('../utils/embed');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: 'admin',
  aliases: ['ovo'],
  execute(message, args) {
    const sub = (args[0] || '').toLowerCase();
    const target = message.mentions.users.first();
    const amount = parseAmount(args[2]);

    if (sub === 'remove' || sub === 'rm' || sub === 'take') {
      if (!target || isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('usage: Aovo remove @user <amount>')] });
      const user = db.ensureUser(target.id);
      if (!user) return message.channel.send({ embeds: [error('user not found')] });
      const actual = Math.min(amount, user.balance);
      db.addBalance(target.id, -actual);
      message.channel.send({ embeds: [success(`removed **${actual}** money from <@${target.id}>`)] });
    } else if (sub === 'add' || sub === 'give') {
      if (!target || isNaN(amount) || amount <= 0) return message.channel.send({ embeds: [error('usage: Aovo add @user <amount>')] });
      db.addBalance(target.id, amount);
      message.channel.send({ embeds: [success(`added **${amount}** money to <@${target.id}>`)] });
    } else if (sub === 'bal' || sub === 'balance') {
      const u = target ? db.ensureUser(target.id) : db.ensureUser(message.author.id);
      if (!u) return message.channel.send({ embeds: [error('user not found')] });
      message.channel.send(`**${u.balance}** money for <@${u.user_id}>`);
    } else if (sub === 'gems' || sub === 'gem') {
      const gsub = (args[1] || '').toLowerCase();
      if (gsub === 'add' || gsub === 'give') {
        const amt = parseAmount(args[3]);
        if (!target || isNaN(amt) || amt <= 0) return message.channel.send({ embeds: [error('usage: Aovo gems add @user <amount>')] });
        db.addGems(target.id, amt);
        message.channel.send({ embeds: [success(`added **${amt}** gem${amt > 1 ? 's' : ''} 💎 to <@${target.id}>`)] });
      } else if (gsub === 'remove' || gsub === 'rm' || gsub === 'take') {
        const amt = parseAmount(args[3]);
        if (!target || isNaN(amt) || amt <= 0) return message.channel.send({ embeds: [error('usage: Aovo gems remove @user <amount>')] });
        db.addGems(target.id, -amt);
        message.channel.send({ embeds: [success(`removed **${amt}** gem${amt > 1 ? 's' : ''} from <@${target.id}>`)] });
      } else if (gsub === 'bal') {
        const u = target ? db.ensureUser(target.id) : db.ensureUser(message.author.id);
        if (!u) return message.channel.send({ embeds: [error('user not found')] });
        message.channel.send(`**${u.gems}** gems 💎 for <@${u.user_id}>`);
      } else {
        message.channel.send({ embeds: [error('usage: Aovo gems add/remove/bal @user <amount>')] });
      }
    } else if (sub === 'lucky') {
      if (!target) return message.channel.send({ embeds: [error('usage: Alucky @user')] });
      if (!db.ensureUser(target.id)) return message.channel.send({ embeds: [error('user not found')] });
      const on = db.toggleLucky(target.id);
      message.channel.send({ embeds: [success(`<@${target.id}> is ${on ? 'now **lucky** 🍀' : 'no longer lucky'}`)] });
    } else if (sub === 'logs' || sub === 'log') {
      if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
      const channel = message.mentions.channels.first();
      if (channel) {
        db.setLogChannel(message.guild.id, channel.id);
        message.channel.send({ embeds: [success(`logs channel set to ${channel}`)] });
      } else {
        db.setLogChannel(message.guild.id, '');
        message.channel.send({ embeds: [success('logs channel removed')] });
      }
    } else if (sub === 'shop') {
      if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
      const channel = message.mentions.channels.first();
      if (!channel) return message.channel.send({ embeds: [error('usage: Aovo shop add #channel')] });
      if (args[1] !== 'add') return message.channel.send({ embeds: [error('usage: Aovo shop add #channel')] });
      const { postShop } = require('./shop');
      postShop(channel);
      return message.channel.send({ embeds: [success(`shop posted in ${channel}`)] });
    } else if (sub === 'viprole') {
      if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
      const role = message.mentions.roles.first();
      if (!role) return message.channel.send({ embeds: [error('usage: Aovo viprole @role')] });
      db.setVipRole(message.guild.id, role.id);
      message.channel.send({ embeds: [success(`VIP role set to ${role}`)] });
    } else if (sub === 'cmdlog' || sub === 'cmdlogs') {
      if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
      const channel = message.mentions.channels.first();
      if (channel) {
        db.setCmdLogChannel(message.guild.id, channel.id);
        message.channel.send({ embeds: [success(`command log channel set to ${channel}`)] });
      } else {
        db.setCmdLogChannel(message.guild.id, '');
        message.channel.send({ embeds: [success('command log channel removed')] });
      }
    } else if (sub === 'updates' || sub === 'update') {
      if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
      const channel = message.mentions.channels.first();
      if (channel) {
        db.setUpdateChannel(message.guild.id, channel.id);
        message.channel.send({ embeds: [success(`update channel set to ${channel}`)] });
      } else {
        db.setUpdateChannel(message.guild.id, '');
        message.channel.send({ embeds: [success('update channel removed')] });
      }
    } else if (sub === 'restart') {
      const { execSync, spawn } = require('child_process');
      const ownerId = '536278876247162882';
      const path = require('path');
      const fs = require('fs');
      const root = path.join(__dirname, '..');
      const lockFile = path.join(root, '.gambot.lock');
      message.channel.send({ embeds: [success('pulling latest + restarting...')] }).then(() => {
        try { execSync('git pull origin master', { stdio: 'pipe', timeout: 15000 }); } catch {}
        message.client.users.fetch(ownerId).then(u => u.send('restarting...').catch(() => {})).catch(() => {});
        if (global._server) try { global._server.close(); } catch {}
        try { fs.unlinkSync(lockFile); } catch {}
        try { message.client.destroy(); } catch {}
        setTimeout(() => {
          if (global._supervisor) return;
          global._supervisor = true;
          const spawnBot = () => {
            const child = spawn('node', [path.join(root, 'index.js')], {
              stdio: 'inherit',
              env: { ...process.env, PORT: process.env.PORT || '3000' },
            });
            child.on('exit', (code) => {
              const lockAlive = (() => { try { return fs.existsSync(lockFile); } catch { return true; } })();
              if (lockAlive) {
                console.error(`[supervisor] bot child exited (code ${code}) — respawning in 3s`);
                setTimeout(spawnBot, 3000);
              } else {
                console.error('[supervisor] clean exit (shutdown) — staying down');
              }
            });
          };
          spawnBot();
        }, 300);
      });
      } else if (sub === 'shutdown' || sub === 'off' || sub === 'kill') {
        if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
        const ownerId = '536278876247162882';
        message.channel.send({ embeds: [success('shutting down...')] }).then(() => {
          message.client.users.fetch(ownerId).then(u => u.send('bot is shutting down').catch(() => {})).catch(() => {});
          if (global._server) try { global._server.close(); } catch {}
          try { message.client.destroy(); } catch {}
          process.exit(0);
        });
      } else if (sub === 'cmds' || sub === 'cmdlist') {
        message.channel.send({ embeds: [embed('Admin Commands', [
          ['Aovo add @user <amount>', 'add money'],
          ['Aovo remove @user <amount>', 'remove money'],
          ['Aovo bal @user', 'check balance'],
          ['Aovo log #channel', 'set shop purchase log channel'],
          ['Aovo cmdlog #channel', 'set command log channel'],
          ['Aovo shop add #channel', 'post shop in channel'],
          ['Aovo viprole @role', 'set VIP role'],
          ['Aovo updates #channel', 'set update channel'],
          ['Aovo addrole @user name | #color', 'create custom role'],
          ['Aovo shutdown', 'fully stop the bot'],
          ['Aovo restart', 'pull updates + restart'],
          ['Aovo pupd <message>', 'view/set push update message'],
        ])] });
      } else if (sub === 'pupd' || sub === 'pushupdate') {
        const fs = require('fs');
        const path = require('path');
        const msgPath = path.join(__dirname, '..', 'update_msg.txt');
        const msg = args.slice(1).join(' ').trim();
        if (!msg) {
          let current = '';
          try { current = fs.readFileSync(msgPath, 'utf8').trim(); } catch {}
          return message.channel.send({ embeds: [embed('📢 Push Update', [
            ['Current', current || '(empty)'],
            ['Set', '`Aovo pupd <message>` to update'],
          ])] });
        }
        fs.writeFileSync(msgPath, msg);
        message.channel.send({ embeds: [success(`update message set to:\n${msg}`)] });
      } else if (sub === 'addrole') {
      if (!message.guild) return message.channel.send({ embeds: [error('must be in a server')] });
      const roleTarget = message.mentions.users.first();
      if (!roleTarget) return message.channel.send({ embeds: [error('usage: Aovo addrole @user <name> | <color>')] });
      const parts = args.slice(2).filter(a => !a.startsWith('<@')).join(' ').split('|').map(s => s.trim());
      if (!parts[0]) return message.channel.send({ embeds: [error('provide a role name')] });
      const color = parseInt(parts[1]?.replace('#', ''), 16) || 0x2b2d31;
      message.guild.roles.create({ name: parts[0], color, reason: `custom role for ${roleTarget.tag}` }).then(role => {
        message.guild.members.fetch(roleTarget.id).then(m => m.roles.add(role).catch(() => {})).catch(() => {});
        message.channel.send({ embeds: [success(`created role **${role.name}** for <@${roleTarget.id}>`)] });
      }).catch(() => {
        message.channel.send({ embeds: [error("can't create role — missing permissions")] });
      });
    } else {
      message.channel.send({ embeds: [embed('Admin', [
        ['Aovo add @user <amount>', 'add money'],
        ['Aovo remove @user <amount>', 'remove money'],
        ['Aovo bal @user', 'check anyones balance'],
        ['Aovo log #channel', 'set shop purchase log channel'],
        ['Aovo cmdlog #channel', 'set command log channel'],
        ['Aovo shop add #channel', 'post shop in channel'],
        ['Aovo viprole @role', 'set VIP role for subscribers'],
        ['Aovo updates #channel', 'set update broadcast channel'],
         ['Aovo addrole @user name | #color', 'create custom role'],
         ['Aovo shutdown', 'fully stop the bot'],
         ['Aovo restart', 'pull updates + restart'],
        ['Aovo pupd <message>', 'view/set push update message'],
      ])] });
    }
  },
};
