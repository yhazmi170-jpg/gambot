const db = require('../db');
const { setSponsored } = require('../utils/embed');
const config = require('../config');
const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder } = require('discord.js');

const SHOP = [
  {
    category: 'ONE-TIME PURCHASES',
    items: [
      { id: 'custom_role', name: 'Custom Role (name + color)', price: 1500000, desc: 'create a custom-named role with your color', use: 'Use v customrole name <name> · v customrole color <#hex [>#hex]> · v customrole delete' },
      { id: 'rob', name: 'v rob @user ability', price: 15000000, desc: '50% steal 50% of target / 50% lose 50% of yours', use: 'Use v rob @user to attempt a robbery' },
      { id: 'double_work', name: 'Double work payout (perm)', price: 6000000, desc: 'permanently earn 2x from v work', use: 'Just use v work — it pays double automatically' },
      { id: 'bet_cap', name: 'Bet Cap II (250k)', price: 2000000, desc: 'bet up to 250k in games', use: 'Use v <game> all to bet up to 250k' },
      { id: 'bet_cap_2', name: 'Bet Cap III (500k)', price: 5000000, desc: 'bet up to 500k in games', use: 'Use v <game> all to bet up to 500k' },
      { id: 'bet_cap_3', name: 'Bet Cap IV (1M)', price: 10000000, desc: 'bet up to 1M in games', use: 'Use v <game> all to bet up to 1M' },
      { id: 'bet_cap_4', name: 'Bet Cap V (2M)', price: 20000000, desc: 'bet up to 2M in games', use: 'Use v <game> all to bet up to 2M' },
      { id: 'bet_cap_5', name: 'Bet Cap VI (5M)', price: 50000000, desc: 'bet up to 5M in games', use: 'Use v <game> all to bet up to 5M' },
      { id: 'lottery_ticket', name: 'Free lottery ticket/draw', price: 7000000, desc: 'get a free ticket every lottery draw', use: 'You will auto-get 1 free ticket each lottery draw' },
      { id: 'vip_games', name: 'VIP game modes access', price: 8000000, desc: 'unlocks exclusive games (poker)', use: 'Use v poker <amount> to play video poker' },
      { id: 'gem', name: 'Gem', price: 2000000, gems: 1, desc: 'every 5 gems you hold = +1 extra animal per hunt (v hunt)', use: 'v hunt — more gems = more animals per hunt' },
      { id: 'gems5', name: 'Gem Pack (x5)', price: 9000000, gems: 5, desc: '5 gems = +1 extra animal per hunt', use: 'v hunt — more gems = more animals per hunt' },
      { id: 'egg_luck', name: 'Egg Luck (2x egg drops)', price: 3500000, desc: 'double your chance of finding eggs while hunting', use: 'Eggs drop 2x as often from v hunt / autohunt — v hatch to open' },
      { id: 'double_quest', name: 'Double Quest Rewards', price: 4000000, desc: 'daily quests and weekly bounties pay 2x', use: 'v quest claim / v bounty claim pay double' },
    ],
  },
  {
    category: 'MONTHLY SUB (auto-renew if you can afford it)',
    items: [
      { id: 'vip_role_sub', name: 'VIP Role', price: 1000000, desc: 'keeps your VIP role while subscribed', monthly: true, use: 'The VIP role is kept while your sub is active' },
      { id: 'insurance', name: 'Insurance (20% loss refund)', price: 300000, desc: '20% of losses refunded', monthly: true, use: 'Losses are auto-refunded 20% — no command needed' },
      { id: 'insurance2', name: 'Insurance Upgrade II (30% refund)', price: 500000, desc: 'raises your loss refund to 30%', monthly: true, use: 'Overrides the base — losses auto-refund 30%' },
      { id: 'insurance3', name: 'Insurance Upgrade III (40% refund)', price: 800000, desc: 'raises your loss refund to 40%', monthly: true, use: 'Overrides lower tiers — losses auto-refund 40%' },
      { id: 'insurance4', name: 'Insurance Upgrade IV (50% refund)', price: 1200000, desc: 'raises your loss refund to 50%', monthly: true, use: 'Overrides lower tiers — losses auto-refund 50%' },
      { id: 'daily_cap', name: 'Higher daily/weekly cap', price: 600000, desc: 'daily cap raised to 15k, weekly to 25k', monthly: true, use: 'Use v daily and v weekly normally — caps are higher' },
    ],
  },
  {
    category: 'SERVER TOOLS',
    items: [
      { id: 'auto_react', name: 'Auto-react on messages', price: 1500000, desc: 'set an emoji that the bot auto-reacts to your messages with', use: 'Use v autoreact <emoji> to set your reaction emoji' },
      { id: 'sponsored_footer', name: 'Sponsored footer on bot', price: 2500000, desc: '"Sponsored by @you" on all bot commands', use: 'Your name appears on all bot embeds' },
      { id: 'rain', name: 'v rain <amount>', price: 3000000, desc: 'rain money to everyone online', use: 'Use v rain <amount> to share money with online members' },
      { id: 'duel', name: 'v duel @user <amount>', price: 2000000, desc: '1v1 coinflip challenge another user', use: 'Use v duel @user <amount> to challenge someone' },
    ],
  },
  {
    category: 'SOCIAL',
    items: [
      { id: 'colored_lb', name: 'Colored leaderboard name', price: 750000, desc: 'your name shows in color on v lb', use: 'Use v setlb <emoji> then check v lb' },
      { id: 'badge', name: 'Custom badge emoji', price: 500000, desc: 'set a badge emoji shown on your profile and lb', use: 'Use v setbadge <emoji>' },
      { id: 'profile', name: 'v profile stat card', price: 600000, desc: 'view detailed stats with v profile', use: 'Use v profile to see your stats' },
      { id: 'rep', name: 'v rep @user', price: 300000, desc: 'give reputation points to others', use: 'Use v rep @user to give reputation' },
    ],
  },
];

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

function buildShop() {
  const containers = [];
  for (const cat of SHOP) {
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

const CATEGORY_SHORT = ['One-Time', 'Monthly Subs', 'Server Tools', 'Social'];

function buildMenuEmbed() {
  const lines = SHOP.map((cat, idx) => `**${CATEGORY_SHORT[idx]}** — ${cat.items.length} item${cat.items.length > 1 ? 's' : ''}`).join('\n');
  return new EmbedBuilder().setColor(0x2b2d31).setTitle('Shop').setDescription(`pick a category to browse items\n\n${lines}`);
}

function buildMenuRow() {
  return new ActionRowBuilder().addComponents(SHOP.map((cat, idx) =>
    new ButtonBuilder().setCustomId(`shop_cat_${idx}`).setLabel(CATEGORY_SHORT[idx]).setStyle(ButtonStyle.Secondary)
  ));
}

function buildCategoryEmbed(cat, idx) {
  const lines = cat.items.map(it => `\`${priceStr(it.price)}\` ${it.name}${it.monthly ? ' /mo' : ''} — ${it.desc}`).join('\n');
  return new EmbedBuilder().setColor(0x2b2d31).setTitle(cat.category).setDescription(`${lines}\n\nclick a button to purchase — confirm on the next screen`);
}

function buildCategoryRows(idx) {
  const cat = SHOP[idx];
  const rows = [];
  let row = [];
  for (const it of cat.items) {
    row.push(new ButtonBuilder()
      .setCustomId(`shop_${it.id}`)
      .setLabel(`${it.name.split('(')[0].trim()} - ${priceStr(it.price)}${it.monthly ? '/mo' : ''}`)
      .setStyle(ButtonStyle.Secondary));
    if (row.length === 5) { rows.push(new ActionRowBuilder().addComponents(row)); row = []; }
  }
  if (row.length) rows.push(new ActionRowBuilder().addComponents(row));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_back').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
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
      if (isNaN(idx) || !SHOP[idx]) return;
      await i.update({ embeds: [buildCategoryEmbed(SHOP[idx], idx)], components: buildCategoryRows(idx) });
      return;
    }
    if (id === 'shop_back') {
      await i.update({ embeds: [buildMenuEmbed()], components: [buildMenuRow()] });
      return;
    }

    await i.deferUpdate();

    const itemId = id.replace('shop_', '');
    const item = SHOP.flatMap(c => c.items).find(it => it.id === itemId);
    if (!item) return;

    if (item.gems) {
      // gem items are currency, not perks — skip the perk-owned check
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
      await i.followUp({ embeds: [errEmbed('Not enough money.')], ephemeral: true });
      return;
    }

    const confirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop_buy_${itemId}`).setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`shop_no_${itemId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    );

    pendingShops.set(i.user.id, { itemId, item, guild: i.guild, channel: i.channel });
    setTimeout(() => pendingShops.delete(i.user.id), 30000);
    await i.followUp({ embeds: [warnEmbed(`**${item.name}**\nPrice: \`${priceStr(price)}\` ${config.currency}${item.monthly ? '/mo' : ''}${saleMult < 1 ? ` ~~\`${priceStr(item.price)}\`~~ **-${Math.round((1 - saleMult) * 100)}% sale!**` : ''}\n\n${item.desc}\n\nConfirm purchase?`)], components: [confirm], ephemeral: true });
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
      await j.update({ embeds: [errEmbed('Purchase cancelled.')], components: [] });
      return;
    }

    const userNow = db.ensureUser(j.user.id);
    const saleMult = db.eventMult('priceMult');
    const price = Math.floor(pending.item.price * saleMult);
    if (!userNow || userNow.balance < price) {
      j.user.send(`You tried to buy **${pending.item.name}** (\`${priceStr(price)}\` ${config.currency}) but you don't have enough money.`).catch(() => {});
      await j.update({ embeds: [errEmbed('Not enough money.')], components: [] });
      return;
    }

    db.addBalance(j.user.id, -price);
    if (pending.item.gems) {
      db.addGems(j.user.id, pending.item.gems);
    } else if (pending.item.monthly) { db.addPerk(j.user.id, pending.itemId, Math.floor(Date.now() / 1000) + 30 * 86400); }
    else { db.addPerk(j.user.id, pending.itemId, 0); }
    if (pending.itemId === 'sponsored_footer') setSponsored(j.user.username);
    if (pending.itemId === 'vip_role_sub' && pending.guild) {
      const vipRoleId = db.getVipRole(pending.guild.id);
      if (vipRoleId) {
        pending.guild.members.fetch(j.user.id).then(m => m.roles.add(vipRoleId).catch(() => {})).catch(() => {});
      }
    }

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
    await j.update({ embeds: [okEmbed(`Purchased **${pending.item.name}**!`)], components: [] });
  } catch (e) { console.error('shop confirm err:', e); }
}

const header = new ContainerBuilder()
  .setAccentColor(0x2b2d31)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent('**SHOP**\nClick a button to purchase.\nConfirm on next screen.'));

function postShop(channel) {
  channel.send({ components: [header, ...buildShop()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

module.exports = { buildShop, postShop, handleInteraction, SHOP, allShopItems, getShopItem,
  name: 'shop',
  helpCategory: 'Shop',
  helpArgs: '',
  description: 'browse and buy perks',
  aliases: ['store', 'market'],
  execute(message, args) {
    message.channel.send({ embeds: [buildMenuEmbed()], components: [buildMenuRow()] });
  },
};
