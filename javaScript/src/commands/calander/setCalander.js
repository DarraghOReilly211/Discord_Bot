const { SlashCommandBuilder } = require('discord.js');
const { setActiveCalendar } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-calendar')
    .setDescription('Choose your active calendar and visibility')
    .addStringOption(o => o.setName('provider').setDescription('Provider').addChoices(
      { name: 'google', value: 'google' },
      { name: 'microsoft', value: 'microsoft' },
    ).setRequired(true))
    .addStringOption(o => o.setName('calendar_id').setDescription('Calendar ID (e.g., primary)').setRequired(true))
    .addStringOption(o => o.setName('visibility').setDescription('Visibility').addChoices(
      { name: 'private', value: 'private' },
      { name: 'public', value: 'public' },
    ).setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const provider = interaction.options.getString('provider', true);
    const calendar_id = interaction.options.getString('calendar_id', true);
    const visibility = interaction.options.getString('visibility', true);

    try {
      const changes = setActiveCalendar(interaction.user.id, provider, calendar_id, visibility);
      if (changes === 0) {
        return interaction.editReply('Calendar not found for your account. Link it first, then try again.');
      }
      return interaction.editReply(`Active ${provider} calendar set to ${calendar_id} (${visibility}).`);
    } catch (e) {
      console.error('set-calendar error:', e);
      return interaction.editReply('Failed to set active calendar.');
    }
  },
};
