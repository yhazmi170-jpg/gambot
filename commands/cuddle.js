const { execSocial } = require('../utils/social');

module.exports = {
  name: 'cuddle',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a cuddle GIF — mention someone or cuddle yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'cuddle');
  },
};