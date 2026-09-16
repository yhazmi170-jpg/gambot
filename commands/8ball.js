const { embed } = require('../utils/embed');

const ANSWERS = [
  'It is certain.',
  'Without a doubt.',
  'You may rely on it.',
  'Yes, definitely.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
];

module.exports = {
  name: '8ball',
  helpCategory: 'Fun',
  helpArgs: '<question>',
  description: 'shake the magic 8 ball and get a yes/no answer',
  aliases: ['eightball', 'ball'],
  execute(message, args) {
    const question = args.join(' ').trim();
    if (!question) {
      return message.channel.send({
        embeds: [embed('🔮 8 Ball', [['Question', 'What do you want to ask?', true], ['Answer', 'Ask me something first.', true]], 0x9b59b6)],
      });
    }

    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    message.channel.send({
      embeds: [embed('🔮 8 Ball', [['Question', question, true], ['Answer', answer, true]], 0x9b59b6)],
    });
  },
};