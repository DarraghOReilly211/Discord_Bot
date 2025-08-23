const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listUserCalendars } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-calendars')
    .setDescription('List your linked calendars')
    .addStringOption(o => o.setName('provider').setDescription('Provider').addChoices(
      { name: 'google', value: 'google' },
      { name: 'microsoft', value: 'microsoft' },
    ).setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const provider = interaction.options.getString('provider', true);

    const rows = listUserCalendars(interaction.user.id, provider);
    if (!rows.length) return interaction.editReply(`No ${provider} calendars linked.`);

    const lines = rows.map(r => `${r.is_active ? '[active] ' : ''}${r.calendar_id} — ${r.visibility}`);
    const embed = new EmbedBuilder().setTitle(`${provider} calendars`).setDescription(lines.join('\n'));
    return interaction.editReply({ embeds: [embed] });
  },
};
