// src/commands/calander/delete-event.js
const { SlashCommandBuilder } = require('discord.js');
const { db, getUserCalendar } = require('../../db');
const { refreshIfNeeded, deleteEvent } = require('./google');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-event')
    .setDescription('Delete a Google Calendar event from your active calendar')
    .addStringOption(o => o.setName('event_id').setDescription('Event ID').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const eventId = interaction.options.getString('event_id', true);

    let row = getUserCalendar(interaction.user.id, 'google');
    if (!row) return interaction.editReply('No active Google calendar set. Use `/set-calendar`.');

    try {
      row = await refreshIfNeeded(row);
      db.prepare(`UPDATE calendars SET access_token=?, refresh_token=?, expires_at=? WHERE id=?`)
        .run(row.access_token, row.refresh_token, row.expires_at, row.id);

      const tokens = {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expiry_date: row.expires_at,
      };
      await deleteEvent(tokens, row.calendar_id, eventId);
      return interaction.editReply(`Deleted event ${eventId}.`);
    } catch (e) {
      console.error('delete-event error:', e);
      return interaction.editReply('Failed to delete event. Make sure the ID is correct and you own the event.');
    }
  },
};
