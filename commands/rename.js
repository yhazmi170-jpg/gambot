const db = require('../db');
const { embed } = require('../utils/embed');

module.exports = {
  name: 'rename',
  description: 'rename an animal in your zoo',
  async execute(message, args) {
    const id = parseInt(args[0]);
    const name = args.slice(1).join(' ');
    if (!id || !name) return message.channel.send({ embeds: [require('../utils/embed').error('usage: `v rename <animal id> <name>`')] });
    if (name.length > 24) return message.channel.send({ embeds: [require('../utils/embed').error('name too long (max 24 chars)')] });

    const animal = db.getAnimal(id);
    if (!animal || animal.user_id !== message.author.id) return message.channel.send({ embeds: [require('../utils/embed').error('animal not found')] });

    db.renameAnimal(id, name);
    message.channel.send({
      embeds: [embed('✅ Renamed', [[`${animal.species}`, `now called **${name}**`]], 0x57f287)],
    });
  },
};
