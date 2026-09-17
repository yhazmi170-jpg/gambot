const { execSocial } = require('../utils/social');

module.exports = {
  name: 'kill',
  helpCategory: 'Fun',
  helpArgs: '[@user]',
  description: 'comically annihilate someone (all love, no actual harm)',
  aliases: [],
  execute(message) {
    execSocial(message, 'kill');
  },
};