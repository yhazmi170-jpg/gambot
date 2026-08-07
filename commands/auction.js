const db = require('../db');
const { embed, error, success } = require('../utils/embed');
const config = require('../config');

module.exports = {
  name: 'auction',
  helpCategory: 'Pets',
  helpArgs: '<id> <min_bid> [hours] | list | cancel <auc>',
  description: 'auction off a pet — players bid before time runs out',
  aliases: ['auct', 'sellauction'],
  execute(message, args) {
    const userId = message.author.id;
    const guildId = message.guild ? message.guild.id : 'global';
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'list') {
      const auctions = db.listAuctions(guildId);
      if (!auctions.length) return message.channel.send({ embeds: [error('no active auctions — `v auction <id> <min_bid>` to list one')] });
      const lines = auctions.map(a => {
        const pet = db.getAnimal(a.animal_id);
        const name = pet ? `${pet.species} (Lv.${pet.level})` : '?';
        const mins = Math.max(0, Math.ceil((a.ends_at - Math.floor(Date.now() / 1000)) / 60));
        return `\`${a.auction_id}\` **${name}** — bid **${a.current_bid.toLocaleString()}**${a.current_bidder ? ` by <@${a.current_bidder}>` : ''} · ends in ${mins}m`;
      });
      return message.channel.send({ embeds: [embed('Auction House', [['Open', lines.join('\n')], ['', 'bid with `v bid <auction_id> <amount>`']])] });
    }

    if (sub === 'cancel') {
      const aucId = args[1];
      if (!aucId) return message.channel.send({ embeds: [error('`v auction cancel <id>`')] });
      const res = db.cancelAuction(aucId, userId);
      if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'owner' ? 'only the seller can cancel' : 'auction not found')] });
      return message.channel.send({ embeds: [success('auction cancelled, any current bid refunded')] });
    }

    const id = parseInt(args[0], 10);
    const minBid = parseInt(args[1], 10);
    if (!id || !minBid || minBid <= 0) return message.channel.send({ embeds: [error('usage: `v auction <animal_id> <min_bid> [hours]` (default 24h)`]')] });
    const hours = args[2] ? parseInt(args[2], 10) : 24;
    const aucId = `${userId}-${Date.now()}`;
    const res = db.createAuction(aucId, guildId, userId, id, minBid, hours);
    if (!res.ok) return message.channel.send({ embeds: [error(res.reason === 'time' ? 'duration must be 1-72 hours' : res.reason === 'team' ? 'that pet is on your battle team — remove it first' : 'pet not found')] });
    return message.channel.send({ embeds: [embed('Auction Listed', [
      ['Auction', `\`${aucId}\``],
      ['Min bid', `${minBid.toLocaleString()} ${config.currency}`],
      ['Duration', `${hours}h`],
      ['Next', `players bid with \`v bid ${aucId} <amount>\` — highest bidder wins, seller pays 5%`],
    ])] });
  },
};