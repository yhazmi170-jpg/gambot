const db = require('../db');
const config = require('../config');
const crypto = require('crypto');
const { withPurchaseLock } = require('../utils/purchaseLock');
const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder } = require('discord.js');

const SHOP = [
  {
    category: 'One-Time',
    short: 'One-Time',
    items: [
      { id: 'rob', name: 'rob', price: 15000000, desc: 'steal ability', use: 'v rob @user' },
      { id: 'double_work', name: 'double_work', price: 6000000, desc: '2x work payout', use: 'v work pays 2x' },
      { id: 'bet_cap', name: 'bet_cap', price: 2000000, desc: '500k max bet', use: 'v <game> all' },
      { id: 'lottery_ticket', name: 'lottery_ticket', price: 7000000, desc: 'free ticket each draw', use: 'auto on draw' },
      { id: 'vip_games', name: 'vip_games', price: 8000000, desc: 'video poker access', use: 'v poker <amount>' },
      { id: 'gem', name: 'gem', price: 2000000, gems: 1, desc: '1 hunt gem', use: 'v hunt' },
      { id: 'gems5', name: 'gems5', price: 9000000, gems: 5, desc: '5 hunt gems', use: 'v hunt' },
      { id: 'egg_luck', name: 'egg_luck', price: 3500000, desc: '2x egg drops', use: 'v hunt' },
      { id: 'double_quest', name: 'double_quest', price: 4000000, desc: '2x quest rewards', use: 'v quest' },
      { id: 'weapon_crate', name: 'weapon_crate', price: 15000, weaponCrates: 1, desc: 'weapon crate', use: 'v weaponcrate open' },
    ],
  },
  {
    category: 'Monthly',
    short: 'Monthly',
    items: [
      { id: 'insurance', name: 'insurance', price: 150000, desc: '10% loss refund', monthly: true, use: 'auto-refund 10%' },
      { id: 'insurance2', name: 'insurance2', price: 300000, desc: '15% loss refund', monthly: true, use: 'auto-refund 15%' },
      { id: 'insurance3', name: 'insurance3', price: 500000, desc: '20% loss refund', monthly: true, use: 'auto-refund 20%' },
      { id: 'insurance4', name: 'insurance4', price: 800000, desc: '25% loss refund', monthly: true, use: 'auto-refund 25%' },
      { id: 'daily_cap', name: 'daily_cap', price: 600000, desc: '15k daily / 25k weekly cap', monthly: true, use: 'v daily' },
    ],
  },
  {
    category: 'Tools',
    short: 'Tools',
    items: [
      { id: 'auto_react', name: 'auto_react', price: 1500000, desc: 'auto-react slot 1', use: 'v autoreact <emoji>' },
      { id: 'auto_react2', name: 'auto_react2', price: 4000000, desc: 'auto-react slot 2', use: 'v autoreact <e1> <e2>' },
      { id: 'auto_react3', name: 'auto_react3', price: 12000000, desc: 'auto-react slot 3', use: 'v autoreact <e1> <e2> <e3>' },
      { id: 'auto_react4', name: 'auto_react4', price: 30000000, desc: 'auto-react slot 4', use: 'v autoreact <e1> <e2> <e3> <e4>' },
      { id: 'rain', name: 'rain', price: 3000000, desc: 'rain money command', use: 'v rain <amount>' },
      { id: 'duel', name: 'duel', price: 2000000, desc: '1v1 coinflip duel', use: 'v duel @user <amount>' },
    ],
  },
  {
    category: 'Social',
    short: 'Social',
    items: [
      { id: 'colored_lb', name: 'colored_lb', price: 750000, desc: 'colored name on lb', use: 'v setlb <emoji>' },
      { id: 'badge', name: 'badge', price: 500000, desc: 'custom badge', use: 'v setbadge <emoji>' },
      { id: 'rep', name: 'rep', price: 300000, desc: 'reputation command', use: 'v rep @user' },
    ],
  },
];

function shopFor(guildId) {
  return SHOP;
}

function allShopItems() {
  return SHOP.flatMap(c => c.items);
}

function getShopItem(id) {
  return allShopItems().find(it => it.id === id || it.name.toLowerCase() === id.toLowerCase());
}

function priceStr(p) {
  if (p >= 1000000) return `${(p / 1000000).toFixed(p % 1000000 === 0 ? 0 : 1)}m`;
  if (p >= 1000) return `${(p / 1000).toFixed(p % 1000 === 0 ? 0 : 1)}k`;
  return String(p);
}

function buildShop(guildId) {
  const list = guildId ? shopFor(guildId) : SHOP;
  const containers = [];
  for (const cat of list) {
    const lines = [`**${cat.category}**`];
    const buttons = [];
    let row = [];
    for (const item of cat.items) {
      lines.push(`\`${priceStr(item.price)}\` ${item.name}${item.monthly ? ' /mo' : ''} — ${item.desc}`);
      row.push(new ButtonBuilder()
        .setCustomId(`shop_${item.id}`)
        .setLabel(`${item.name} - ${priceStr(item.price)}${item.monthly ? '/mo' : ''}`)
        .setStyle(ButtonStyle.Secondary));
      if (row.length === 5) { buttons.push(new ActionRowBuilder().addComponents(row)); row = []; }
    }
    if (row.length) buttons.push(new ActionRowBuilder().addComponents(row));
    containers.push(new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
      .addActionRowComponents(...buttons));
  }
  return containers;
}

const pendingShops = new Map();

function buildMenuEmbed(userOrId, guildId) {
  let uid = null;
  if (typeof userOrId === 'string' && /^\d{16,21}$/.test(userOrId)) uid = userOrId;
  else if (userOrId && userOrId.id) uid = userOrId.id;
  else if (!guildId && typeof userOrId === 'string') guildId = userOrId;

  const user = uid ? db.ensureUser(uid) : null;
  const saleMult = db.eventMult('priceMult');

  const lines = [
    user ? `Balance: **${user.balance.toLocaleString()}** ${config.currency}` : '',
    saleMult < 1 ? `Sale: ${Math.round((1 - saleMult) * 100)}% off` : '',
    '',
    '**One-Time**',
    'rob (15m) • double_work (6m) • bet_cap (2m) • lottery_ticket (7m)',
    'vip_games (8m) • gem (2m) • gems5 (9m) • egg_luck (3.5m)',
    'double_quest (4m) • weapon_crate (15k)',
    '',
    '**Monthly**',
    'insurance (150k/mo) • insurance2 (300k/mo) • insurance3 (500k/mo)',
    'insurance4 (800k/mo) • daily_cap (600k/mo)',
    '',
    '**Tools**',
    'auto_react (1.5m) • rain (3m) • duel (2m)',
    '',
    '**Social**',
    'colored_lb (750k) • badge (500k) • rep (300k)',
  ].filter(l => l !== null);

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Shop')
    .setDescription(lines.join('\n'));
}

function buildMenuRow(guildId) {
  const list = guildId ? shopFor(guildId) : SHOP;
  return new ActionRowBuilder().addComponents(list.map((cat, idx) =>
    new ButtonBuilder()
      .setCustomId(`shop_cat_${idx}`)
      .setLabel(cat.short || cat.category)
      .setStyle(ButtonStyle.Secondary)
  ));
}

function buildCategoryEmbed(cat, idx, userOrId, guildId) {
  let uid = null;
  if (typeof userOrId === 'string' && /^\d{16,21}$/.test(userOrId)) uid = userOrId;
  else if (userOrId && userOrId.id) uid = userOrId.id;

  const user = uid ? db.ensureUser(uid) : null;
  const saleMult = db.eventMult('priceMult');

  const itemsText = cat.items.map(it => {
    const isPerkItem = !it.gems && !it.weaponCrates;
    const owned = isPerkItem && uid && db.hasPerk(uid, it.id);
    const effPrice = Math.floor(it.price * saleMult);
    const priceText = `${priceStr(effPrice)}${it.monthly ? '/mo' : ''}`;

    if (owned) {
      return `• **${it.name}** [OWNED] — ${it.desc}`;
    }
    return `• **${it.name}** (${priceText}) — ${it.desc}`;
  }).join('\n');

  const walletStr = user ? `Balance: **${user.balance.toLocaleString()}** ${config.currency}\n\n` : '';

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`Shop — ${cat.category}`)
    .setDescription(`${walletStr}${itemsText}`);
}

function buildCategoryRows(idx, userOrId, guildId) {
  let uid = null;
  if (typeof userOrId === 'string' && /^\d{16,21}$/.test(userOrId)) uid = userOrId;
  else if (userOrId && userOrId.id) uid = userOrId.id;

  const cat = guildId ? shopFor(guildId)[idx] : SHOP[idx];
  const rows = [];
  let row = [];

  for (const it of cat.items) {
    const isPerkItem = !it.gems && !it.weaponCrates;
    const owned = isPerkItem && uid && db.hasPerk(uid, it.id);
    const btn = new ButtonBuilder().setCustomId(`shop_${it.id}`);

    if (owned) {
      btn.setLabel(`${it.name} [OWNED]`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
    } else {
      btn.setLabel(it.name)
        .setStyle(ButtonStyle.Secondary);
    }

    row.push(btn);
    if (row.length === 5) {
      rows.push(new ActionRowBuilder().addComponents(row));
      row = [];
    }
  }

  if (row.length) {
    rows.push(new ActionRowBuilder().addComponents(row));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
  ));

  return rows;
}

function errEmbed(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(text);
}

async function startPurchase(user, item, channel, guild, interaction) {
  const isPerkItem = !item.gems && !item.weaponCrates;
  if (isPerkItem && db.hasPerk(user.id, item.id)) {
    const msg = { embeds: [errEmbed('You already own this perk.')], ephemeral: true };
    return interaction ? interaction.followUp(msg) : channel.send(msg);
  }

  if (pendingShops.has(user.id)) {
    const msg = { embeds: [errEmbed('You have a pending purchase. Complete or wait for it.')], ephemeral: true };
    return interaction ? interaction.followUp(msg) : channel.send(msg);
  }

  const u = db.ensureUser(user.id);
  const saleMult = db.eventMult('priceMult');
  const price = Math.floor(item.price * saleMult);
  if (!u || u.balance < price) {
    const msg = { embeds: [errEmbed(`Not enough money. Need **${price.toLocaleString()}** ${config.currency}.`)], ephemeral: true };
    return interaction ? interaction.followUp(msg) : channel.send(msg);
  }

  const confirm = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop_buy_${item.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`shop_no_${item.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  const purchaseId = crypto.randomUUID();
  pendingShops.set(user.id, { itemId: item.id, item, guild, channel, purchaseId });
  setTimeout(() => pendingShops.delete(user.id), 30000);

  const confirmEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Confirm')
    .setDescription(
      `Buy **${item.name}** for **${price.toLocaleString()}** ${config.currency}${item.monthly ? ' (/mo)' : ''}?\n` +
      `Balance after: **${(u.balance - price).toLocaleString()}** ${config.currency}`
    );

  if (interaction) {
    await interaction.followUp({ embeds: [confirmEmbed], components: [confirm], ephemeral: true });
  } else {
    channel.send({ embeds: [confirmEmbed], components: [confirm] });
  }
}

async function handleInteraction(i) {
  try {
    const id = i.customId;
    if (id.startsWith('shop_buy_') || id.startsWith('shop_no_')) { await handleConfirm(i); return; }

    if (id.startsWith('shop_cat_')) {
      const idx = parseInt(id.replace('shop_cat_', ''), 10);
      const list = i.guild ? shopFor(i.guild.id) : SHOP;
      if (isNaN(idx) || !list[idx]) return;
      await i.update({
        embeds: [buildCategoryEmbed(list[idx], idx, i.user.id, i.guild && i.guild.id)],
        components: buildCategoryRows(idx, i.user.id, i.guild && i.guild.id)
      });
      return;
    }
    if (id === 'shop_back') {
      await i.update({
        embeds: [buildMenuEmbed(i.user.id, i.guild && i.guild.id)],
        components: [buildMenuRow(i.guild && i.guild.id)]
      });
      return;
    }

    await i.deferUpdate();

    const itemId = id.replace('shop_', '');
    const list = i.guild ? shopFor(i.guild.id) : SHOP;
    const item = list.flatMap(c => c.items).find(it => it.id === itemId);
    if (!item) return;

    await startPurchase(i.user, item, i.channel, i.guild, i);
  } catch (e) { console.error('shop item err:', e); }
}

async function handleConfirm(j) {
  try {
    const isBuy = j.customId.startsWith('shop_buy_');
    const pending = pendingShops.get(j.user.id);
    pendingShops.delete(j.user.id);

    if (!pending) {
      await j.update({ embeds: [errEmbed('Session expired — click the item again.')], components: [] });
      return;
    }
    if (!isBuy) {
      await j.update({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Cancelled.')], components: [] });
      return;
    }

    const purchaseId = pending.purchaseId || `${j.user.id}:${pending.itemId}:${j.id}`;
    await withPurchaseLock(purchaseId, async () => {
      const saleMult = db.eventMult('priceMult');
      const price = Math.floor(pending.item.price * saleMult);
      if (price <= 0) {
        await j.update({ embeds: [errEmbed('Payment failed — you were not charged.')], components: [] });
        return;
      }

      let purchaseOk = false;
      const isPerkItem = !pending.item.gems && !pending.item.weaponCrates;
      if (isPerkItem) {
        const expiresAt = pending.item.monthly ? Math.floor(Date.now() / 1000) + 30 * 86400 : 0;
        const res = db.purchasePerk(j.user.id, pending.itemId, price, expiresAt, purchaseId);
        if (res.success) {
          purchaseOk = true;
        } else {
          console.error('shop purchase failed:', res && res.error, 'user:', j.user.id, 'item:', pending.itemId, 'purchase:', purchaseId);
          await j.update({ embeds: [errEmbed('Your order was not charged.')], components: [] });
          return;
        }
      } else {
        if (db.isPurchaseCommitted(purchaseId)) {
          purchaseOk = true;
        } else {
          const userNow = db.ensureUser(j.user.id);
          if (!userNow || userNow.balance < price) {
            j.user.send(`You tried to buy **${pending.item.name}** (${priceStr(price)} ${config.currency}) but you don't have enough money.`).catch(() => {});
            await j.update({ embeds: [errEmbed('Not enough money.')], components: [] });
            return;
          }
          db.addBalance(j.user.id, -price);
          if (pending.item.gems) db.addGems(j.user.id, pending.item.gems);
          else if (pending.item.weaponCrates) db.addWeaponCrate(j.user.id, pending.item.weaponCrates);
          db.recordCommittedPurchase(purchaseId, j.user.id, pending.itemId, price, 0);
          purchaseOk = true;
        }
      }
      if (!purchaseOk) return;

      const logChId = db.getLogChannel(pending.guild?.id || '');
      if (logChId) {
        const logCh = pending.guild?.channels.cache.get(logChId);
        if (logCh) {
          logCh.send(`<@${j.user.id}> bought **${pending.item.name}** for \`${priceStr(pending.item.price)}\` ${config.currency}`).catch(() => {});
        } else {
          pending.guild?.channels.fetch(logChId).then(ch => ch.send(`<@${j.user.id}> bought **${pending.item.name}** for \`${priceStr(pending.item.price)}\` ${config.currency}`).catch(() => {})).catch(() => {});
        }
      }
      pending.channel?.send(`<@${j.user.id}> bought **${pending.item.name}** for \`${priceStr(pending.item.price)}\` ${config.currency}!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
      j.user.send(`Purchased **${pending.item.name}** for \`${priceStr(pending.item.price)}\` ${config.currency} in **${pending.guild?.name || 'the server'}**\nUse: ${pending.item.use}`).catch(() => {});
      for (const adminId of config.dmOwners) j.client.users.fetch(adminId).then(o => o.send(`<@${j.user.id}> bought **${pending.item.name}** for \`${priceStr(pending.item.price)}\` ${config.currency}!`).catch(() => {})).catch(() => {});
      await j.update({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Bought **${pending.item.name}** for **${price.toLocaleString()}** ${config.currency}.\nUse: \`${pending.item.use}\``)],
        components: []
      });
    });
  } catch (e) { console.error('shop confirm err:', e); }
}

const header = new ContainerBuilder()
  .setAccentColor(0x2b2d31)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent('**SHOP**\nClick a button to purchase.\nConfirm on next screen.'));

function postShop(channel, guildId) {
  channel.send({ components: [header, ...buildShop(guildId)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

module.exports = { buildShop, postShop, handleInteraction, SHOP, allShopItems, getShopItem,
  name: 'shop',
  helpCategory: 'Shop',
  helpArgs: '[category | buy <item>]',
  description: 'browse and buy perks & upgrades',
  aliases: ['store', 'market', 'buy'],
  execute(message, args) {
    const guildId = message.guild && message.guild.id;
    const uid = message.author.id;
    const first = (args[0] || '').toLowerCase();

    if (first === 'buy' || message.content.toLowerCase().startsWith('v buy') || message.content.toLowerCase().startsWith('vbuy')) {
      const itemQuery = (first === 'buy' ? args.slice(1).join(' ') : args.join(' ')).trim().toLowerCase();
      if (!itemQuery) return message.channel.send({ embeds: [errEmbed('usage: `v buy <item>` — check `v shop` for items')] });
      const item = allShopItems().find(it => it.id.toLowerCase() === itemQuery || it.name.toLowerCase().includes(itemQuery));
      if (!item) return message.channel.send({ embeds: [errEmbed('item not found — check `v shop` for item names')] });
      return startPurchase(message.author, item, message.channel, message.guild, null);
    }

    if (first) {
      const catIdx = ['1', 'onetime', 'one-time', 'perm'].includes(first) ? 0 :
                     ['2', 'sub', 'subs', 'monthly'].includes(first) ? 1 :
                     ['3', 'server', 'tools', 'tool'].includes(first) ? 2 :
                     ['4', 'social'].includes(first) ? 3 : -1;
      if (catIdx !== -1) {
        const list = guildId ? shopFor(guildId) : SHOP;
        return message.channel.send({
          embeds: [buildCategoryEmbed(list[catIdx], catIdx, uid, guildId)],
          components: buildCategoryRows(catIdx, uid, guildId),
        }).then(msg => {
          if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
          setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
        });
      }
    }

    message.channel.send({
      embeds: [buildMenuEmbed(uid, guildId)],
      components: [buildMenuRow(guildId)]
    }).then(msg => {
      if (global._interactionOwners) global._interactionOwners.set(msg.id, message.author.id);
      setTimeout(() => { if (global._interactionOwners) global._interactionOwners.delete(msg.id); }, 300000);
    });
  },
};
