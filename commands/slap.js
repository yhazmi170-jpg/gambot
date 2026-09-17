const { execSocial } = require('../utils/social');

module.exports = {
  name: 'slap',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a slap GIF — mention someone or slap yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'slap');
  },
};