// src/commands/calander/set-calendar.js
const { SlashCommandBuilder } = require('discord.js');
const { db, getActiveCalendar, upsertCalendar, setActiveCalendar } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-calendar')
    .setDescription('Set which calendar is active for your linked account')
    .addStringOption(o =>
      o
        .setName('calendar_id')
        .setDescription('Calendar ID (e.g., from /list-calendars)')
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName('visibility')
        .setDescription('Whether others can view your events via /events @you')
        .addChoices(
          { name: 'private', value: 'private' },
          { name: 'public', value: 'public' }
        )
        .setRequired(false)
    )
    .addStringOption(o =>
      o
        .setName('provider')
        .setDescription('Calendar provider (default: google)')
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
      const calendar_id = interaction.options.getString('calendar_id', true);
      const visibility = interaction.options.getString('visibility') || 'private';

      if (!['google', 'microsoft'].includes(provider)) {
        return interaction.editReply('Unsupported provider.');
      }

      // Get any existing row for this provider so we can copy tokens.
      // Prefer the active row; if none active, take any row.
      let row = getActiveCalendar(interaction.user.id, provider)
             || db.prepare(
                  `SELECT * FROM calendars WHERE discord_user_id=? AND provider=? LIMIT 1`
                ).get(interaction.user.id, provider);

      if (!row) {
        return interaction.editReply(
          `No linked ${provider} account found. Use /link-calendar first.`
        );
      }

      // Ensure there is a DB row for the chosen calendar_id with tokens.
      upsertCalendar({
        discord_user_id: interaction.user.id,
        provider,
        calendar_id,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.expires_at,
        visibility,
        is_active: 1, // will be normalized by setActiveCalendar below
      });

      // Flip active flag so only this one is active
      setActiveCalendar(interaction.user.id, provider, calendar_id);

      // Optional: verify it actually became active
      const active = getActiveCalendar(interaction.user.id, provider);
      if (!active || active.calendar_id !== calendar_id) {
        return interaction.editReply(
          'Failed to activate that calendar (no DB row was updated). Double-check the calendar ID from /list-calendars.'
        );
      }

      return interaction.editReply(
        `Active ${provider} calendar set to \`${calendar_id}\` (${visibility}).`
      );
    } catch (err) {
      console.error('set-calendar error:', err);
      return interaction.editReply('Failed to set the active calendar. Check the ID and try again.');
    }
  },
};
