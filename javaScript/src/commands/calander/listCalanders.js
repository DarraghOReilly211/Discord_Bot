// src/commands/calander/listCalanders.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getActiveCalendar, upsertCalendar } = require('../../db');
const { refreshIfNeeded } = require('./google');

// Ensure fetch exists across Node versions
const fetch = globalThis.fetch ?? ((...args) =>
  import('node-fetch').then(({ default: f }) => f(...args))
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-calendars')
    .setDescription('List calendars from your linked account (Google only for now)')
    .addIntegerOption(o =>
      o
        .setName('max')
        .setDescription('How many to show (default 10, max 25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const max = interaction.options.getInteger('max') ?? 10;

      // Only Google supported for now
      const row = getActiveCalendar(interaction.user.id, 'google');
      if (!row) {
        return interaction.editReply(
          'No active Google calendar found. Use `/link-calendar provider:Google` first, or run `/set-calendar`.'
        );
      }

      // Refresh tokens if needed and persist
      const refreshed = await refreshIfNeeded(row);
      upsertCalendar(refreshed);

      // Call Google CalendarList API
      const resp = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
        { headers: { Authorization: `Bearer ${refreshed.access_token}` } }
      );

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Google calendarList failed: ${resp.status} ${txt}`);
      }

      const data = await resp.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        return interaction.editReply('No calendars found on your Google account.');
      }

      // Build embed
      const trimmed = items.slice(0, max);
      const embed = new EmbedBuilder()
        .setTitle(`Your Google calendars — showing ${trimmed.length}/${items.length}`)
        .setTimestamp(new Date());

      for (const cal of trimmed) {
        // Prepare a clean line per calendar
        const title =
          (cal.primary ? '⭐ ' : '') +
          (cal.summaryOverride || cal.summary || '(no title)');

        const lines = [
          `**ID:** \`${cal.id}\``,
          `**Access:** ${cal.accessRole || 'unknown'}`,
          `**Visibility:** ${cal.hidden ? 'hidden' : 'visible'}`,
          cal.selected ? '**Selected:** ✅' : null,
          cal.timeZone ? `**TZ:** ${cal.timeZone}` : null,
        ].filter(Boolean);

        const value = lines.join('\n').slice(0, 1024); // field value limit
        embed.addFields({ name: title.slice(0, 256), value });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('list-calendars error:', err);
      return interaction.editReply(
        'Failed to list calendars. Make sure your Google link is valid, then try again.'
      );
    }
  },
};
