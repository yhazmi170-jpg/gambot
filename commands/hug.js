const { execSocial } = require('../utils/social');

module.exports = {
  name: 'hug',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a hug GIF — mention someone or hug yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'hug');
  },
};