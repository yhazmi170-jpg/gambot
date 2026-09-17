const { execSocial } = require('../utils/social');

module.exports = {
  name: 'kiss',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a kiss GIF — mention someone or kiss yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'kiss');
  },
};