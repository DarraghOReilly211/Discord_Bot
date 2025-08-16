module.exports = {
  name: "ping",
  description: "Pong!",
  // devOnly: Boolean,
  // testOnly: Boolean,
  // deleted: Boolean,

  callback: (client, interaction) => {
    interaction.reply("Pong!");
  },
};