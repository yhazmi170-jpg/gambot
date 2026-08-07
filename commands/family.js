const db = require('../db');
const { embed, error } = require('../utils/embed');

module.exports = {
  name: 'family',
  helpCategory: 'Social',
  helpArgs: '',
  description: 'view your family tree (partner, parents, children)',
  aliases: ['fam', 'tree'],
  execute(message, args) {
    const userId = message.author.id;
    const marriage = db.getMarriage(userId);
    const parents = db.getParents(userId);
    const children = db.getChildren(userId);

    const fields = [];
    if (marriage) {
      const days = Math.floor((Date.now() / 1000 - marriage.married_at) / 86400);
      fields.push(['❤️ Married', `<@${marriage.partner_id}> — married for **${days}** day${days === 0 ? '' : 's'}\nmarried perk: **+10%** daily & work income`]);
    } else {
      fields.push(['Marriage', 'single — marry with `v marry @user`']);
    }
    const parentField = parents.length ? parents.map(id => `<@${id}>`).join(' and ') : 'unknown';
    fields.push(['Parents', parentField]);
    const childField = children.length ? children.map(id => `<@${id}>`).join(', ') : 'none';
    fields.push(['Children', childField]);
    fields.push(['', 'family members get a **+10%** bonus on daily and work income']);

    return message.channel.send({ embeds: [embed('🌳 Family', fields)] });
  },
};