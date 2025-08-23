// events/bannedWords.js
const words = require('../config/words.js');

module.exports = {
  name: 'messageCreate', // real event name
  async execute(message) {
    if (message.author.bot) return; // ignore bots

    const foundWords = words.filter(word => 
      message.content.toLowerCase().includes(word.toLowerCase())
    );

    if (foundWords.length > 0) {
      try {
        await message.delete();
        await message.channel.send(
          `${message.author}, your message contained banned words: ${foundWords.join(', ')}`
        );
      } catch (err) {
        console.error('Failed to delete message or notify:', err);
      }
    }
  },
};
