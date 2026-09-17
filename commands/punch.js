const { execSocial } = require('../utils/social');

module.exports = {
  name: 'punch',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a (comedic) punch GIF — mention someone or punch yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'punch');
  },
};