// src/commands/calander/visibility.js
const { SlashCommandBuilder } = require('discord.js');
const { setActiveVisibility, getActiveCalendar } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('visibility')
    .setDescription('Set your active calendar visibility (public/private)')
    // ✅ required option FIRST
    .addStringOption(o =>
      o
        .setName('value')
        .setDescription('Visibility to apply on the active calendar')
        .addChoices(
          { name: 'public', value: 'public' },
          { name: 'private', value: 'private' }
        )
        .setRequired(true)
    )
    // ✅ optional AFTER required
    .addStringOption(o =>
      o
        .setName('provider')
        .setDescription('Provider for which to set visibility (default: google)')
        .addChoices(
          { name: 'Google', value: 'google' },
          { name: 'Microsoft', value: 'microsoft' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const provider = (interaction.options.getString('provider') || 'google').toLowerCase();
      const value = interaction.options.getString('value', true);

      const active = getActiveCalendar(interaction.user.id, provider);
      if (!active) {
        return interaction.editReply(`No active ${provider} calendar — link and set one active first.`);
      }

      const changed = setActiveVisibility(interaction.user.id, provider, value);
      if (changed === 0) {
        return interaction.editReply(`Nothing changed — your active ${provider} calendar is already **${value}**.`);
      }
      return interaction.editReply(
        `Updated ${provider} visibility to **${value}** for \`${active.calendar_id}\`.`
      );
    } catch (e) {
      console.error('visibility error:', e);
      return interaction.editReply('Failed to update visibility.');
    }
  },
};
