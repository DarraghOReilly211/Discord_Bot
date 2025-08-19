const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong'),

  async execute(interaction) {
    const user = interaction.user;
    await interaction.channel.send('${user.username} sent ping 🏓');
    await interaction.channel.send('🏓 Pong!');
  },
};