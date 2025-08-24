// src/commands/calander/unlink-calendar.js
const { SlashCommandBuilder } = require('discord.js');
const { unlinkProvider } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink-calendar')
    .setDescription('Unlink (remove) your calendars for a provider')
    .addStringOption(o =>
      o
        .setName('provider')
        .setDescription('Which provider to unlink')
        .addChoices(
          { name: 'Google', value: 'google' },
          { name: 'Microsoft', value: 'microsoft' }
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const provider = interaction.options.getString('provider', true);
      const n = unlinkProvider(interaction.user.id, provider);
      if (n === 0) {
        return interaction.editReply(`No ${provider} link found to remove.`);
      }
      return interaction.editReply(`Unlinked ${provider} — removed ${n} record(s).`);
    } catch (e) {
      console.error('unlink-calendar error:', e);
      return interaction.editReply('Failed to unlink. Try again in a moment.');
    }
  },
};
