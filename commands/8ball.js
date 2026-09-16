const MAX_QUESTION_LEN = 100;

function sanitizeQuestion(q) {
  return q.replace(/[\\*_~`>|#@<&]/g, m => '\\' + m);
}

const ANSWERS = [
  'absolutely 😭',
  'yes yes yes',
  '100% trust',
  'the vibes are yes',
  'yessss go for it',
  'obviously bestie',
  'the universe said yes',
  'signs point to yes',
  'hell nah',
  'do NOT do that',
  'absolutely not 😭',
  'the universe said no',
  'pls dont',
  'signs point to no',
  'lowkey... yeah 😭',
  'lowkey...',
  'maybe if u lock in',
  'give it 5 business days',
  'ask ur lawyer',
  'coin says yes, i say no',
  'unfortunately yes',
  'fortunately no',
  'we might be cooked',
  'source: trust me',
  'probably 💀',
  '50/50 bestie',
  'depends on ur sleep schedule',
  'bro i dont know 😭',
  'i forgot the question already',
  'im pretending i didnt hear that',
  'ask again when im awake',
  'the magic ball glitched 💀',
  'somehow yes',
  'u got this',
  'lucky aura detected',
  'not looking good gang',
  'yeah ur cooked',
  'the voices said yes',
  'ur on ur own with this one',
  'ask ur rubber duck',
  'i asked the cat, the cat said yes',
  'the math says maybe',
  "it's giving good luck",
  'the stars said its ur day',
  'try again after a snack',
];

module.exports = {
  name: '8ball',
  helpCategory: 'Fun',
  helpArgs: '<question>',
  description: 'silly magic answers — alias `v 8b <question>`',
  aliases: ['8b', 'eightball', 'ball'],
  execute(message, args) {
    let question = args.join(' ').trim();

    if (!question.replace(/[?\s]+$/g, '').trim()) {
      return message.channel.send({ content: '🎱 ask something 😭\n`v 8b am i cooked`' });
    }

    if (question.length > MAX_QUESTION_LEN) {
      question = question.slice(0, MAX_QUESTION_LEN).trimEnd() + '…';
    }

    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    message.channel.send({ content: `🎱 **${sanitizeQuestion(question)}**\n${answer}` });
  },
};