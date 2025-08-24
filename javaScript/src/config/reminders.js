const { SlashCommandBuilder } = require('discord.js');
const { saveReminderSettings } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('Configure event reminders (lead time, DM/channel, role)')
    .addIntegerOption(o => o.setName('lead_minutes').setDescription('Minutes before event to remind (default 15)').setMinValue(1))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post reminders (optional)'))
    .addRoleOption(o => o.setName('role').setDescription('Role to mention (optional)'))
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable reminders (default true)')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const lead = interaction.options.getInteger('lead_minutes') ?? 15;
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    const enabled = interaction.options.getBoolean('enabled');
    const notify_channel_id = channel ? channel.id : null;
    const notify_role_id = role ? role.id : null;

    saveReminderSettings({
      discord_user_id: interaction.user.id,
      provider: 'google',
      lead_minutes: lead,
      notify_channel_id,
      notify_role_id,
      enabled: enabled === null ? 1 : (enabled ? 1 : 0),
    });

    return interaction.editReply('Reminder settings saved.');
  },
};
