const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OBJECTIVE_ALIASES = {
  hunt: 'hunt', hunts: 'hunt',
  sacrifice: 'sacrifice', sacrifices: 'sacrifice', die: 'sacrifice', dies: 'sacrifice',
  battle: 'battle', battles: 'battle', win: 'battle',
  work: 'work', works: 'work',
  give: 'give', gives: 'give', gift: 'give', donate: 'give', send: 'give',
  hatch: 'hatch', eggs: 'hatch', egg: 'hatch',
  quest: 'quest', quests: 'quest',
  checklist: 'checklist', todo: 'checklist', daily: 'checklist',
};

const STATUS_EMOJI = { pending: '🕐', active: '⚡', completed: '✅', declined: '💥', cancelled: '🚫', expired: '⏳' };

function objectiveLabel(key) {
  const def = db.CONTRACT_OBJECTIVES[key];
  return def ? def.label : key;
}

function contractFields(c, selfId) {
  const emoji = STATUS_EMOJI[c.status] || '▪️';
  const other = c.creator_id === selfId ? `<@${c.target_id}>` : `<@${c.creator_id}>`;
  const role = c.creator_id === selfId ? 'creator' : 'target';
  const progress = c.status === 'active'
    ? `${c.progress}/${c.objective_n} (${Math.floor((c.progress / c.objective_n) * 100)}%)`
    : `${c.finished ? '' : `${c.progress}/`}${c.objective_n}`;
  return [
    [`#${c.id} — ${emoji} ${role} vs ${other}`, ''] ,
    ['Objective', `${objectiveLabel(c.objective)}: **${progress}**`],
    ['Reward', `**${c.reward.toLocaleString()}** ${config.currency} (escrowed)`],
    ['Status', `${c.status}${c.expires_at ? ` — expires <t:${c.expires_at}:R>` : ''}`],
  ];
}

function offerRow(c) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cnt_accept_${c.id}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`cnt_decline_${c.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('💥'),
  );
}

function progressBar(progress, n) {
  const filled = Math.round((progress / Math.max(1, n)) * 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

async function handleInteraction(i) {
  const parts = (i.customId || '').split('_');
  if (parts[0] !== 'cnt' || parts.length < 3) return;
  const id = Number(parts[2]);
  if (!id) return;
  const c = db.getContract(id);
  if (!c) return i.update({ embeds: [error('contract gone')], components: [] }).catch(() => {});
  if (c.target_id !== i.user.id) {
    return i.reply({ content: 'that aint ur contract to touch', ephemeral: true }).catch(() => i.deferUpdate().catch(() => {}));
  }

  if (parts[1] === 'accept') {
    const res = db.acceptContract(id, i.user.id);
    if (!res.ok) return i.update({ embeds: [error(res.reason === 'status' ? 'this contract isnt awaiting an answer anymore' : 'nope')], components: [] }).catch(() => {});
    return i.update({
      embeds: [embed('✅ Contract accepted', contractFields(res.contract, i.user.id), 0x57f287)],
      components: [],
    }).catch(() => {});
  }

  if (parts[1] === 'decline') {
    const res = db.declineContract(id, i.user.id);
    if (!res.ok) return i.update({ embeds: [error('cant decline this one')], components: [] }).catch(() => {});
    return i.update({
      embeds: [embed('💥 Contract declined', [['', `<@${c.creator_id}> gets their **${c.reward.toLocaleString()}** ${config.currency} back — no harm done`]], 0xed4245)],
      components: [],
    }).catch(() => {});
  }
}

module.exports = {
  name: 'contract',
  helpCategory: 'Economy',
  helpArgs: '[create <@user> <objective> <n> <reward> | accept <id> | decline <id> | cancel <id>]',
  description: 'offer a bounty-style contract to someone — they earn ur coins for doing a task',
  aliases: ['contracts'],
  handleInteraction,
  execute(message, args) {
    const cmd = (args[0] || '').toLowerCase();
    const userId = message.author.id;

    if (!cmd || cmd === 'list' || cmd === 'view') {
      const mine = db.listContractsFor(userId, ['pending', 'active', 'completed']);
      if (!mine.length) {
        return message.channel.send({ embeds: [embed('📜 Contracts', [['', 'u have no contracts yet.\n`v contract create @user hunt 5 50000` — they earn ur coins for hunting 5 animals']], 0x57f287)] });
      }
      const fields = [];
      for (const c of mine) {
        const emoji = STATUS_EMOJI[c.status] || '▪️';
        const other = c.creator_id === userId ? `<@${c.target_id}>` : `<@${c.creator_id}>`;
        if (c.status === 'active' && c.creator_id === userId) {
          fields.push([`${emoji} #${c.id} ${objectiveLabel(c.objective)} vs ${other}`, `\`${progressBar(c.progress, c.objective_n)}\` ${c.progress}/${c.objective_n} — pays **${c.reward.toLocaleString()}**`]);
        } else if (c.status === 'pending') {
          const role = c.creator_id === userId ? 'waiting on them to accept' : '**offer — press accept below it**';
          fields.push([`${emoji} #${c.id} ${objectiveLabel(c.objective)} against ${other}`, `${role} — pays **${c.reward.toLocaleString()}** — expires <t:${c.expires_at}:R>`]);
        } else {
          fields.push([`${emoji} #${c.id} ${objectiveLabel(c.objective)} vs ${other}`, `paid out — **${c.reward.toLocaleString()}** ${config.currency}`]);
        }
      }
      return message.channel.send({ embeds: [embed('📜 Contracts', fields.slice(0, 8), 0x57f287)] });
    }

    if (cmd === 'create' || cmd === 'offer') {
      const target = message.mentions.users.first();
      if (!target) return message.channel.send({ embeds: [error('mention who the contract goes to')] });
      if (target.id === userId) return message.channel.send({ embeds: [error('no self contracts')] });
      const objective = OBJECTIVE_ALIASES[String(args[2] || '').toLowerCase()];
      if (!objective) {
        return message.channel.send({ embeds: [error(`unknown objective — pick one of: ${Object.keys(db.CONTRACT_OBJECTIVES).join(', ')}`)] });
      }
      const n = Math.floor(Number(args[3]));
      const reward = Number(args[4]);
      if (!n || n < 1 || n > 500) return message.channel.send({ embeds: [error('amount (n) must be between 1 and 500')] });
      if (!reward || reward < 1000 || reward > 100000000) return message.channel.send({ embeds: [error('reward must be between 1,000 and 100,000,000 coins')] });
      const who = Math.floor(Number(args[3]));

      const me = db.ensureUser(userId);
      if (!me || me.balance < reward) return message.channel.send({ embeds: [error(`u need **${reward.toLocaleString()}** ${config.currency} free to escrow this`)] });

      const confirmBtn = new ButtonBuilder().setCustomId('cpropose').setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅');
      const cancelBtn = new ButtonBuilder().setCustomId('cabort').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌');
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      message.channel.send({
        embeds: [embed('📜 Contract offer (live as soon as u confirm)', [
          ['To', `<@${target.id}>`],
          ['Objective', `${objectiveLabel(objective)} × **${who}**`],
          ['Reward', `**${reward.toLocaleString()}** ${config.currency} (escrowed now)`],
          ['', 'if they finish it, the payout drops straight into their inbox. if they decline or it expires, u get ur coins back.'],
        ], 0xfee75c)],
        components: [row],
      }).then(msg => {
        if (global._interactionOwners) global._interactionOwners.set(msg.id, userId);
        const filter = i => i.user.id === userId && ['cpropose', 'cabort'].includes(i.customId);
        const col = msg.createMessageComponentCollector({ filter, time: 20000, max: 1 });
        col.on('collect', async (i) => {
          if (i.customId === 'cabort') {
            return i.update({ embeds: [embed('❌ Cancelled', [], 0xed4245)], components: [] }).catch(() => {});
          }
          const res = db.createContract(userId, target.id, objective, who, reward);
          if (!res.ok) {
            const reason = res.reason === 'no-funds' ? 'balance changed — not enough money' : res.reason === 'reward-range' ? 'reward out of range' : 'contract rejected';
            return i.update({ embeds: [error(reason)], components: [] }).catch(() => {});
          }
          const c = db.getContract(res.id);
          if (global._interactionOwners) global._interactionOwners.set(msg.id, target.id);
          return i.update({
            embeds: [embed('📜 Contract offered', contractFields(c, userId), 0xfee75c),
              embed('', [['', `<@${target.id}>, u have a contract waiting — press accept to lock it in, or decline to send <@${userId}> their money back`]], 0x2b2d31)],
            components: [offerRow(c)],
          }).catch(() => {});
        });
        col.on('end', async (collected) => {
          if (!collected.size) await msg.edit({ embeds: [embed('⏱ Expired', [], 0xed4245)], components: [] }).catch(() => {});
        });
      });
      return;
    }

    if (cmd === 'accept' || cmd === 'decline' || cmd === 'cancel') {
      const id = Number(args[1]);
      if (!id) return message.channel.send({ embeds: [error('give a contract id')] });
      const c = db.getContract(id);
      if (!c) return message.channel.send({ embeds: [error('no contract with that id')] });

      if (cmd === 'cancel') {
        if (c.creator_id !== userId) return message.channel.send({ embeds: [error('only the creator can cancel')] });
        const res = db.cancelContract(id, userId);
        if (!res.ok) return message.channel.send({ embeds: [error('cant cancel this one anymore')] });
        return message.channel.send({ embeds: [success(`contract #${id} cancelled — ur **${c.reward.toLocaleString()}** ${config.currency} is back`)] });
      }

      if (cmd === 'accept') {
        if (c.target_id !== userId) return message.channel.send({ embeds: [error("u aren't the one this contract is for")] });
        const res = db.acceptContract(id, userId);
        if (!res.ok) return message.channel.send({ embeds: [error('this contract isnt awaiting an answer')] });
        return message.channel.send({ embeds: [success(`contract #${id} accepted — finish **${objectiveLabel(c.objective)} ${c.objective_n}×** to earn **${c.reward.toLocaleString()}** ${config.currency}`)] });
      }

      if (cmd === 'decline') {
        if (c.target_id !== userId) return message.channel.send({ embeds: [error("u aren't the one this contract is for")] });
        const res = db.declineContract(id, userId);
        if (!res.ok) return message.channel.send({ embeds: [error('cant decline this one')] });
        return message.channel.send({ embeds: [success(`contract #${id} declined — <@${c.creator_id}> gets their money back`)] });
      }
    }

    return message.channel.send({
      embeds: [embed('📜 Contract help', [
        ['create', '`v contract create <@user> <objective> <n> <reward>` — money is escrowed until they finish it'],
        ['objectives', Object.keys(db.CONTRACT_OBJECTIVES).join(', ')],
        ['accept', '`v contract accept <id>` (or the button on the offer)'],
        ['decline', '`v contract decline <id>` — creator gets refunded'],
        ['cancel', '`v contract cancel <id>` — ur own pending offer'],
        ['', 'if they finish, the payout lands in their inbox (`v claim`).'],
      ], 0x57f287)],
    });
  },
};