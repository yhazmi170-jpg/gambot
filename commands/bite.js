const { execSocial } = require('../utils/social');

module.exports = {
  name: 'bite',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'send a (comedic) bite GIF — mention someone or bite yourself',
  aliases: [],
  execute(message) {
    execSocial(message, 'bite');
  },
};