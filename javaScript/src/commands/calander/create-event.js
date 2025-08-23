// src/commands/calander/create-event.js
const { SlashCommandBuilder } = require('discord.js');
const dayjs = require('dayjs');
const { db, getUserCalendar } = require('../../db');
const { refreshIfNeeded, createEvent } = require('./google');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-event')
    .setDescription('Create a Google Calendar event on your active calendar')
    .addStringOption(o => o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o => o.setName('start_iso').setDescription('Start in ISO 8601 (e.g., 2025-08-30T13:00)').setRequired(true))
    .addStringOption(o => o.setName('end_iso').setDescription('End in ISO 8601 (e.g., 2025-08-30T14:00)').setRequired(true))
    .addStringOption(o => o.setName('location').setDescription('Optional location').setRequired(false))
    .addStringOption(o => o.setName('description').setDescription('Optional description').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString('title', true);
    const startISO = interaction.options.getString('start_iso', true);
    const endISO = interaction.options.getString('end_iso', true);
    const location = interaction.options.getString('location') || undefined;
    const description = interaction.options.getString('description') || undefined;

    if (!dayjs(startISO).isValid() || !dayjs(endISO).isValid()) {
      return interaction.editReply('Invalid ISO datetimes. Example: 2025-08-30T13:00');
    }
    if (dayjs(endISO).isBefore(dayjs(startISO))) {
      return interaction.editReply('End must be after start.');
    }

    let row = getUserCalendar(interaction.user.id, 'google');
    if (!row) {
      return interaction.editReply('No Google calendar linked or marked active. Use `/set-calendar` or link your calendar first.');
    }

    try {
      row = await refreshIfNeeded(row);
      db.prepare(`UPDATE calendars SET access_token=?, refresh_token=?, expires_at=? WHERE id=?`)
        .run(row.access_token, row.refresh_token, row.expires_at, row.id);

      const tokens = {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expiry_date: row.expires_at,
      };
      const created = await createEvent(tokens, row.calendar_id, {
        summary: title,
        location,
        description,
        start: { dateTime: dayjs(startISO).toISOString() },
        end: { dateTime: dayjs(endISO).toISOString() },
      });

      return interaction.editReply(`Created event: ${created.htmlLink || created.id}`);
    } catch (e) {
      console.error('create-event error:', e);
      return interaction.editReply('Failed to create event. Check that your calendar is linked and tokens have the right scopes.');
    }
  },
};
