const db = require('../db');
const config = require('../config');
const crypto = require('crypto');
const { withPurchaseLock } = require('../utils/purchaseLock');
const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder } = require('discord.js');

const SHOP = [
  {
    category: 'ONE-TIME PURCHASES',
    items: [
      { id: 'rob', name: 'v rob @user ability', price: 15000000, desc: '30% chance to steal 20% of target\'s balance (max 3M) / 70% chance you lose 20% of your balance (max 3M) + 30m jail, insurance downgrade, -50 credit', use: 'Use v rob @user to attempt a robbery (requires rob perk)' },
      { id: 'double_work', name: 'Double work payout (perm)', price: 6000000, desc: 'permanently earn 2x from v work', use: 'Just use v work — it pays double automatically' },
      { id: 'bet_cap', name: 'Bet Cap (500k)', price: 2000000, desc: 'bet up to 500k in games (max)', use: 'Use v <game> all to bet up to 500k' },
      { id: 'lottery_ticket', name: 'Free lottery ticket/draw', price: 7000000, desc: 'get a free ticket every lottery draw', use: 'You will auto-get 1 free ticket each lottery draw' },
      { id: 'vip_games', name: 'VIP game modes access', price: 8000000, desc: 'unlocks exclusive games (poker)', use: 'Use v poker <amount> to play video poker' },
      { id: 'gem', name: 'Gem', price: 2000000, gems: 1, desc: 'every 5 gems you hold = +1 extra animal per hunt (v hunt)', use: 'v hunt — more gems = more animals per hunt' },
      { id: 'gems5', name: 'Gem Pack (x5)', price: 9000000, gems: 5, desc: '5 gems = +1 extra animal per hunt', use: 'v hunt — more gems = more animals per hunt' },
      { id: 'egg_luck', name: 'Egg Luck (2x egg drops)', price: 3500000, desc: 'double your chance of finding eggs while hunting', use: 'Eggs drop 2x as often from v hunt / autohunt — v hatch to open' },
      { id: 'double_quest', name: 'Double Quest Rewards', price: 4000000, desc: 'daily quests and weekly bounties pay 2x', use: 'v quest claim / v bounty claim pay double' },
      { id: 'weapon_crate', name: 'Weapon Crate', price: 15000, weaponCrates: 1, desc: 'open it for a random weapon: Great Sword, Poison Dagger, Flame Staff, Vampiric Staff, Healing Staff, Defender Aegis, Bow, Rune of Power', use: 'v weaponcrate open — equip with v weapon equip #<wepId> #<animalId>' },
    ],
  },
  {
    category: 'MONTHLY SUB (auto-renew if you can afford it)',
    items: [
      { id: 'insurance', name: 'Insurance (10% loss refund)', price: 150000, desc: '10% of losses refunded', monthly: true, use: 'Losses are auto-refunded 10% — no command needed' },
      { id: 'insurance2', name: 'Insurance Upgrade II (15% refund)', price: 300000, desc: 'raises your loss refund to 15%', monthly: true, use: 'Overrides the base — losses auto-refund 15%' },
      { id: 'insurance3', name: 'Insurance Upgrade III (20% refund)', price: 500000, desc: 'raises your loss refund to 20%', monthly: true, use: 'Overrides lower tiers — losses auto-refund 20%' },
      { id: 'insurance4', name: 'Insurance Upgrade IV (25% refund)', price: 800000, desc: 'raises your loss refund to 25%', monthly: true, use: 'Overrides lower tiers — losses auto-refund 25%' },
      { id: 'daily_cap', name: 'Higher daily/weekly cap', price: 600000, desc: 'daily cap raised to 15k, weekly to 25k', monthly: true, use: 'Use v daily and v weekly normally — caps are higher' },
    ],
  },
  {
    category: 'SERVER TOOLS',
    items: [
      { id: 'auto_react', name: 'Auto-react on messages', price: 1500000, desc: 'set an emoji that the bot auto-reacts to your messages with', use: 'Use v autoreact <emoji> to set your reaction emoji' },
      { id: 'auto_react2', name: 'Auto-react — 2nd emoji slot', price: 4000000, desc: 'react with TWO emojis at once instead of one', use: 'Use v autoreact ☠️ 🔥 to set both' },
      { id: 'auto_react3', name: 'Auto-react — 3rd emoji slot', price: 12000000, desc: 'react with THREE emojis at once', use: 'Use v autoreact ☠️ 🔥 💀 to set all three' },
      { id: 'auto_react4', name: 'Auto-react — 4th emoji slot', price: 30000000, desc: 'react with FOUR emojis at once (max)', use: 'Use v autoreact ☠️ 🔥 💀 🌟 to set all four' },
      { id: 'rain', name: 'v rain <amount>', price: 3000000, desc: 'rain money to everyone online', use: 'Use v rain <amount> to share money with online members' },
      { id: 'duel', name: 'v duel @user <amount>', price: 2000000, desc: '1v1 coinflip challenge another user', use: 'Use v duel @user <amount> to challenge someone' },
    ],
  },
  {
    category: 'SOCIAL',
    items: [
      { id: 'colored_lb', name: 'Colored leaderboard name', price: 750000, desc: 'your name shows in color on v lb', use: 'Use v setlb <emoji> then check v lb' },
      { id: 'badge', name: 'Custom badge emoji', price: 500000, desc: 'set a badge emoji shown on your profile and lb', use: 'Use v setbadge <emoji>' },
      { id: 'rep', name: 'v rep @user', price: 300000, desc: 'give reputation points to others', use: 'Use v rep @user to give reputation' },
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
  return allShopItems().find(it => it.id === id);
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
        .setLabel(`${item.name.split('(')[0].trim()} - ${priceStr(item.price)}${item.monthly ? '/mo' : ''}`)
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

const CATEGORY_ICONS = ['🛍️', '📅', '🛠️', '👥'];
const CATEGORY_SHORT = ['One-Time', 'Monthly Subs', 'Server Tools', 'Social'];
const CATEGORY_TITLES = ['One-Time Upgrades', 'Monthly Subscriptions', 'Server Tools', 'Social & Identity'];
const CATEGORY_DESCS = [
  'Permanent perks, hunting gems, egg luck & bet caps',
  'Auto-renewing loss insurance & higher daily/weekly caps',
  'Auto-react slots, rain command & 1v1 coinflip duels',
  'Custom profile badge, colored lb names & rep command',
];

function buildMenuEmbed(userOrId, guildId) {
  let uid = null;
  if (typeof userOrId === 'string' && /^\d{16,21}$/.test(userOrId)) uid = userOrId;
  else if (userOrId && userOrId.id) uid = userOrId.id;
  else if (!guildId && typeof userOrId === 'string') guildId = userOrId;

  const list = guildId ? shopFor(guildId) : SHOP;
  const user = uid ? db.ensureUser(uid) : null;
  const ownedPerks = uid ? db.getUserPerks(uid).map(p => p.perk) : [];
  const saleMult = db.eventMult('priceMult');

  let banner = '';
  if (saleMult < 1) {
    banner = `🔥 **STOREWIDE SALE: ${Math.round((1 - saleMult) * 100)}% OFF EVERYTHING!**\n\n`;
  }

  const walletStr = user
    ? `💳 **Wallet:** **${user.balance.toLocaleString()}** ${config.currency}  •  💎 **${user.gems || 0}** gems  •  ⭐ **${ownedPerks.length}** perks owned\n\n`
    : '';

  const catLines = list.map((cat, idx) => {
    return `${CATEGORY_ICONS[idx]} **${CATEGORY_TITLES[idx]}** (\`${cat.items.length} items\`)\n└ ${CATEGORY_DESCS[idx]}`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🛍️ Gambot Perks & Upgrades Shop')
    .setDescription(
      `${walletStr}${banner}` +
      `Pick a category below to browse items and purchase:\n\n` +
      `${catLines}`
    )
    .setFooter({ text: 'Tap a category button below to view items & prices' });
}

function buildMenuRow(guildId) {
  const list = guildId ? shopFor(guildId) : SHOP;
  return new ActionRowBuilder().addComponents(list.map((cat, idx) =>
    new ButtonBuilder()
      .setCustomId(`shop_cat_${idx}`)
      .setLabel(CATEGORY_SHORT[idx])
      .setEmoji(CATEGORY_ICONS[idx])
      .setStyle(ButtonStyle.Primary)
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
    const priceText = saleMult < 1
      ? `~~${priceStr(it.price)}~~ **${priceStr(effPrice)}**`
      : `\`${priceStr(effPrice)}\``;
    const monthlyText = it.monthly ? ' `/mo`' : '';

    if (owned) {
      return `✅ **${it.name}**${monthlyText} — \`[OWNED]\`\n└ *${it.desc}*`;
    }

    return `🔹 ${priceText} **${it.name}**${monthlyText}\n└ *${it.desc}*`;
  }).join('\n\n');

  const walletStr = user ? `💳 **Your Balance:** **${user.balance.toLocaleString()}** ${config.currency}\n\n` : '';

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${CATEGORY_ICONS[idx]} Shop — ${CATEGORY_TITLES[idx]}`)
    .setDescription(
      `${walletStr}` +
      `${itemsText}\n\n` +
      `*Click an item button below to purchase. You will confirm before money is spent.*`
    )
    .setFooter({ text: '◀ Categories to return to menu' });
}

function buildCategoryRows(idx, userOrId, guildId) {
  let uid = null;
  if (typeof userOrId === 'string' && /^\d{16,21}$/.test(userOrId)) uid = userOrId;
  else if (userOrId && userOrId.id) uid = userOrId.id;

  const cat = guildId ? shopFor(guildId)[idx] : SHOP[idx];
  const user = uid ? db.ensureUser(uid) : null;
  const saleMult = db.eventMult('priceMult');
  const rows = [];
  let row = [];

  for (const it of cat.items) {
    const isPerkItem = !it.gems && !it.weaponCrates;
    const owned = isPerkItem && uid && db.hasPerk(uid, it.id);
    const effPrice = Math.floor(it.price * saleMult);
    const shortLabel = it.name.split('(')[0].trim().replace(/^v\s+/, '');

    const btn = new ButtonBuilder().setCustomId(`shop_${it.id}`);

    if (owned) {
      btn.setLabel(`${shortLabel.slice(0, 16)} (Owned)`)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
    } else {
      const canAfford = user && user.balance >= effPrice;
      btn.setLabel(`${shortLabel.slice(0, 16)} • ${priceStr(effPrice)}${it.monthly ? '/mo' : ''}`)
        .setStyle(canAfford ? ButtonStyle.Success : ButtonStyle.Secondary);
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
    new ButtonBuilder().setCustomId('shop_back').setLabel('◀ Categories').setEmoji('🔙').setStyle(ButtonStyle.Danger)
  ));

  return rows;
}

function errEmbed(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(text);
}
function okEmbed(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(text);
}
function warnEmbed(text) {
  return new EmbedBuilder().setColor(0xfee75c).setDescription(text);
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

    if (item.gems) {
      // gem items are currency, not perks — skip the perk-owned check
    } else if (item.weaponCrates) {
      // consumable — everyone can buy more
    } else if (db.hasPerk(i.user.id, itemId)) {
      await i.followUp({ embeds: [errEmbed('You already own this perk.')], ephemeral: true });
      return;
    }

    if (pendingShops.has(i.user.id)) {
      await i.followUp({ embeds: [errEmbed('You already have a pending purchase. Finish or wait for it to expire.')], ephemeral: true });
      return;
    }

    const user = db.ensureUser(i.user.id);
    const saleMult = db.eventMult('priceMult');
    const price = Math.floor(item.price * saleMult);
    if (!user || user.balance < price) {
      i.user.send(`You tried to buy **${item.name}** (\`${priceStr(price)}\` ${config.currency}) but you don't have enough money.`).catch(() => {});
      await i.followUp({ embeds: [errEmbed(`Not enough money. You need **${price.toLocaleString()}** ${config.currency} (Balance: **${(user?.balance || 0).toLocaleString()}**).`)], ephemeral: true });
      return;
    }

    const confirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop_buy_${itemId}`).setLabel('Confirm Purchase').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`shop_no_${itemId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    );

    const purchaseId = crypto.randomUUID();
    pendingShops.set(i.user.id, { itemId, item, guild: i.guild, channel: i.channel, purchaseId });
    setTimeout(() => pendingShops.delete(i.user.id), 30000);

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('🛒 Confirm Purchase')
      .setDescription(
        `Are you sure you want to purchase **${item.name}**?\n\n` +
        `🪙 **Price:** **${price.toLocaleString()}** ${config.currency}${item.monthly ? ' (auto-renews monthly)' : ''}${saleMult < 1 ? ` ~~\`${priceStr(item.price)}\`~~ **-${Math.round((1 - saleMult) * 100)}% SALE!**` : ''}\n` +
        `💳 **Balance After:** **${user.balance.toLocaleString()}** ➔ **${(user.balance - price).toLocaleString()}** ${config.currency}\n\n` +
        `📝 **Description:** ${item.desc}\n` +
        `💡 **How to use:** \`${item.use}\``
      );

    await i.followUp({ embeds: [confirmEmbed], components: [confirm], ephemeral: true });
  } catch (e) { console.error('shop item err:', e); }
}

async function handleConfirm(j) {
  try {
    const isBuy = j.customId.startsWith('shop_buy_');
    const pending = pendingShops.get(j.user.id);
    pendingShops.delete(j.user.id);

    if (!pending) {
      await j.update({ embeds: [errEmbed('Session expired — please click the shop item again.')], components: [] });
      return;
    }
    if (!isBuy) {
      await j.update({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ Purchase cancelled.')], components: [] });
      return;
    }

    const purchaseId = pending.purchaseId || `${j.user.id}:${pending.itemId}:${j.id}`;
    await withPurchaseLock(purchaseId, async () => {
      const saleMult = db.eventMult('priceMult');
      const price = Math.floor(pending.item.price * saleMult);
      if (price <= 0) {
        await j.update({ embeds: [errEmbed('Payment failed — you were not charged. Contact support.')], components: [] });
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
          await j.update({ embeds: [errEmbed('Your order was not charged. If your balance looks wrong, contact support.')], components: [] });
          return;
        }
      } else {
        if (db.isPurchaseCommitted(purchaseId)) {
          purchaseOk = true;
        } else {
          const userNow = db.ensureUser(j.user.id);
          if (!userNow || userNow.balance < price) {
            j.user.send(`You tried to buy **${pending.item.name}** (\`${priceStr(price)}\` ${config.currency}) but you don't have enough money.`).catch(() => {});
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
      j.user.send(`**Purchase Confirmation**\nYou bought **${pending.item.name}** for \`${priceStr(pending.item.price)}\` ${config.currency} in **${pending.guild?.name || 'the server'}**\n\n**How to use:** ${pending.item.use}`).catch(() => {});
      for (const adminId of config.dmOwners) j.client.users.fetch(adminId).then(o => o.send(`<@${j.user.id}> bought **${pending.item.name}** for \`${priceStr(pending.item.price)}\` ${config.currency}!`).catch(() => {})).catch(() => {});
      await j.update({
        embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('✅ Purchase Successful').setDescription(`You bought **${pending.item.name}** for **${price.toLocaleString()}** ${config.currency}!\n\n**How to use:** ${pending.item.use}`)],
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
  helpArgs: '[category]',
  description: 'browse and buy perks & upgrades',
  aliases: ['store', 'market'],
  execute(message, args) {
    const guildId = message.guild && message.guild.id;
    const uid = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    if (sub) {
      const catIdx = ['1', 'onetime', 'one-time', 'perm', 'permanent'].includes(sub) ? 0 :
                     ['2', 'sub', 'subs', 'monthly', 'month'].includes(sub) ? 1 :
                     ['3', 'server', 'tools', 'tool'].includes(sub) ? 2 :
                     ['4', 'social', 'rep', 'badge'].includes(sub) ? 3 : -1;
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
