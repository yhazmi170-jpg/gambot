const db = require('../db');
const { embed, error } = require('../utils/embed');

const userCd = new Map();

module.exports = {
  name: 'creature',
  helpCategory: 'Fun',
  description: 'sight the local creature (event only)',
  aliases: ['sighting', 'beast'],
  execute(message) {
    if (!db.isCommunityEvent('creature')) {
      return message.channel.send({ embeds: [error('no creature sighted right now — it comes and goes (`v event`)')] });
    }
    if (!message.guild) return message.channel.send({ embeds: [error('creature sightings only happen in servers')] });
    const uid = message.author.id;
    const now = Date.now();
    if ((userCd.get(uid) || 0) > now - 3600000) {
      return message.channel.send({ embeds: [error('you already filed a sighting within the last hour')] });
    }
    userCd.set(uid, now);
    db.bumpCounter(uid, 'wanted_marked');
    const n = db.ensureUser(uid).wanted_marked || 0;
    db.addBalance(uid, 2500);
    try { db.addIncident(message.guild.id, 'event', `<@${uid}> filed a creature sighting (#${n})`); } catch {}
    message.channel.send({
      embeds: [embed('🦄 Creature Sighted', [
        ['', `<@${uid}> swears they saw it behind the rare spawns. reward paid: **${2500}** coins. the creature remains officially unconfirmed.`],
        ['sightings', `**${n}** total — the more sightings, the more "credible" this gets`],
      ], 0x9b59b6)],
    });
  },
};