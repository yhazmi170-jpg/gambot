const db = require('../db');
const { embed, error } = require('../utils/embed');

const RARITY_ORDER = db.RARITY_ORDER;
const RARITY_EMOJIS = { common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟨', mythic: '👑' };
const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };

function bar(pct, size = 10) {
  const filled = Math.max(0, Math.min(size, Math.round((pct / 100) * size)));
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

module.exports = {
  name: 'dex',
  helpCategory: 'Pets',
  helpArgs: '[rarity | shiny | missing]',
  aliases: ['index', 'collection', 'pokedex', 'animaldex'],
  description: 'your species dex: completion %, per-rarity progress, shiny dex and missing species',
  execute(message, args) {
    const userId = message.author.id;
    const owned = db.getOwnedSpecies(userId);
    const prog = db.dexProgress(userId);
    const sub = (args[0] || '').toLowerCase();

    const e = embed(`👑 ${message.author.username}'s Animal Dex`);
    e.setColor(0x5865f2);

    if (sub === 'shiny') {
      const shinyRows = db.exec(`SELECT DISTINCT species FROM animals WHERE user_id = '${userId}' AND shiny = 1`);
      const shiny = shinyRows.length ? shinyRows[0].values.map(v => v[0]) : [];
      e.setDescription(`✨ **Shiny Dex — ${shiny.length}/${prog.total}**\n${shiny.length ? shiny.map(s => `✨ **${s}**`).join(' · ') : 'no shiny species yet — hunt for that ✨'}`);
      return message.channel.send({ embeds: [e] });
    }

    if (sub === 'missing') {
      const have = new Set(Object.values(owned).flat());
      const miss = [];
      for (const r of RARITY_ORDER) for (const s of db.SPECIES[r]) if (!have.has(s)) miss.push(`${RARITY_EMOJIS[r]} ${s}`);
      e.setDescription(`**Missing — ${prog.missing}/${prog.total}**\n${miss.length ? miss.join(' · ') : 'you own every species. unreal.'}`);
      return message.channel.send({ embeds: [e] });
    }

    if (sub && !RARITY_ORDER.includes(sub)) {
      return message.channel.send({ embeds: [error(`invalid — use a rarity (${RARITY_ORDER.join(', ')}), \`shiny\`, or \`missing\``)] });
    }

    if (sub) {
      const have = new Set(owned[sub] || []);
      const rp = prog.byRarity[sub];
      const names = db.SPECIES[sub] || [];
      const row = names.map(n => (have.has(n) ? `${RARITY_EMOJIS[sub]} **${n}**` : `— ~~${n}~~`)).join(' · ');
      e.setDescription(`${RARITY_LABEL[sub]} (${rp.owned}/${rp.total})\n${bar(rp.total ? (rp.owned / rp.total) * 100 : 0)} ${rp.owned}/${rp.total}${rp.done ? ' ✅ complete' : ''}\n\n${row}`);
      return message.channel.send({ embeds: [e] });
    }

    const lines = [];
    for (const r of RARITY_ORDER) {
      const rp = prog.byRarity[r];
      const pct = rp.total ? (rp.owned / rp.total) * 100 : 0;
      lines.push(`${RARITY_EMOJIS[r]} **${RARITY_LABEL[r]}** ${bar(pct)} ${rp.owned}/${rp.total}${rp.done ? ' ✅' : ` · ${rp.missing} missing`}`);
    }
    const next = db.nextDexMilestone(prog);
    const nextLine = next ? `next milestone: **${next.name}** (${prog.owned}/${next.need})` : 'every species-count milestone cleared 🏆';

    e.setDescription(
      `**Collection: ${prog.owned}/${prog.total} (${prog.percent}%)** · ${prog.missing} missing\n` +
      `${bar(prog.percent)} ${prog.percent}%\n` +
      `✨ shiny species: **${prog.shinySpecies}**\n\n` +
      lines.join('\n') +
      `\n\n${nextLine}`
    );
    message.channel.send({ embeds: [e] });
  },
};
