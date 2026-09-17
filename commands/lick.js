const { execSocial } = require('../utils/social');

module.exports = {
  name: 'lick',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a (silly) lick GIF — mention someone or lick yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'lick');
  },
};