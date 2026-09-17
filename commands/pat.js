const { execSocial } = require('../utils/social');

module.exports = {
  name: 'pat',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a headpat GIF — mention someone or pat yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'pat');
  },
};