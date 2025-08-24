// src/commands/misc/ping.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong'),

  async execute(interaction) {
    const user = interaction.user;

    // Always respond to the interaction first
    await interaction.reply({ content: `🏓 Pong! (requested by ${user.username})` });

    // Optionally also post in the channel (non-ephemeral)
    await interaction.channel.send(`${user.username} sent ping 🏓`);
  },
};
