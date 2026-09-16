const MAX_QUESTION_LEN = 100;

const ANSWERS = [
  { text: 'absolutely', reaction: '😭' },
  { text: 'yes yes yes', reaction: '😭' },
  { text: '100% trust', reaction: '😭' },
  { text: 'the vibes are yes', reaction: '😭' },
  { text: 'yessss go for it', reaction: '😭' },
  { text: 'obviously bestie', reaction: '😭' },
  { text: 'the universe said yes', reaction: '😭' },
  { text: 'signs point to yes', reaction: '😭' },
  { text: 'hell nah', reaction: '☠️' },
  { text: 'do NOT do that', reaction: '☠️' },
  { text: 'absolutely not', reaction: '☠️' },
  { text: 'the universe said no', reaction: '☠️' },
  { text: 'pls dont', reaction: '☠️' },
  { text: 'signs point to no', reaction: '☠️' },
  { text: 'lowkey... yeah', reaction: '😭' },
  { text: 'lowkey...', reaction: '😭' },
  { text: 'maybe if u lock in', reaction: '😭' },
  { text: 'give it 5 business days', reaction: '😭' },
  { text: 'ask ur lawyer', reaction: '😭' },
  { text: 'coin says yes, i say no', reaction: '☠️' },
  { text: 'unfortunately yes', reaction: '😭' },
  { text: 'fortunately no', reaction: '😭' },
  { text: 'we might be cooked', reaction: '😭' },
  { text: 'source: trust me', reaction: '😭' },
  { text: 'probably', reaction: '😭' },
  { text: '50/50 bestie', reaction: '😭' },
  { text: 'depends on ur sleep schedule', reaction: '😭' },
  { text: 'bro i dont know', reaction: '😭' },
  { text: 'i forgot the question already', reaction: '😭' },
  { text: 'im pretending i didnt hear that', reaction: '😭' },
  { text: 'ask again when im awake', reaction: '😭' },
  { text: 'the magic ball glitched', reaction: '😭' },
  { text: 'somehow yes', reaction: '😭' },
  { text: 'u got this', reaction: '😭' },
  { text: 'lucky aura detected', reaction: '😭' },
  { text: 'not looking good gng', reaction: '☠️' },
  { text: 'yeah ur cooked', reaction: '☠️' },
  { text: 'the voices said yes', reaction: '😭' },
  { text: 'ur on ur own with this one', reaction: '😭' },
  { text: 'ask ur rubber duck', reaction: '😭' },
  { text: 'i asked the cat, the cat said yes', reaction: '😭' },
  { text: 'the math says maybe', reaction: '😭' },
  { text: "it's giving good luck", reaction: '😭' },
  { text: 'the stars said its ur day', reaction: '😭' },
  { text: 'try again after a snack', reaction: '😭' },
];

module.exports = {
  name: '8ball',
  helpCategory: 'Fun',
  helpArgs: '<question>',
  description: 'silly magic answers — alias `v 8b <question>`',
  aliases: ['8b', 'eightball', 'ball'],
  ANSWERS,
  execute(message, args) {
    let question = args.join(' ').trim();

    if (!question.replace(/[?\s]+$/g, '').trim()) {
      return message.reply({ content: 'ask something 😭', allowedMentions: { repliedUser: false } });
    }

    if (question.length > MAX_QUESTION_LEN) {
      question = question.slice(0, MAX_QUESTION_LEN).trimEnd() + '…';
    }

    const pick = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];

    message.reply({ content: pick.text, allowedMentions: { repliedUser: false } })
      .then(sent => sent.react(pick.reaction).catch(() => {}))
      .catch(() => {});
  },
};