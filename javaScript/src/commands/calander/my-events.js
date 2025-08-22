const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dayjs = require('dayjs');

// Use explicit extensions to avoid resolution issues
const { db, getUserCalendar } = require('./db.js');
const { listUpcomingEvents, refreshIfNeeded } = require('./google.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-events')
    .setDescription('Show your upcoming Google Calendar events')
    .addIntegerOption(option =>
      option
        .setName('count')
        .setDescription('How many events to show (default 5)')
        .setMinValue(1)
        .setMaxValue(20)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const count = interaction.options.getInteger('count') || 5;

    // Find the linked calendar row for this Discord user
    let row = getUserCalendar(interaction.user.id, 'google');
    if (!row) {
      return interaction.editReply(
        'You have not linked your calendar yet. Use `/link-calendar` and complete the sign-in.'
      );
    }

    // Refresh tokens if needed and persist updates
    try {
      row = await refreshIfNeeded(row);
      db.prepare(
        `UPDATE calendars
           SET access_token = ?, refresh_token = ?, expires_at = ?
         WHERE id = ?`
      ).run(row.access_token, row.refresh_token, row.expires_at, row.id);
    } catch (err) {
      console.error('Token refresh failed:', err);
      return interaction.editReply(
        'Token refresh failed. Please run `/link-calendar` again and approve access.'
      );
    }

    // Fetch events
    try {
      const tokens = {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expiry_date: row.expires_at,
      };

      // Default to primary if no calendar_id saved
      const calendarId = row.calendar_id || 'primary';

      const events = await listUpcomingEvents(tokens, calendarId, { maxResults: count });

      if (!events.length) {
        return interaction.editReply('No upcoming events found.');
      }

      const embed = new EmbedBuilder()
        .setTitle('Your upcoming events')
        .setTimestamp(new Date());

      // First event with a detailed block
      embed.setDescription(formatEvent(events[0]));

      // Remaining events as compact lines
      for (const evt of events.slice(1)) {
        embed.addFields({
          name: evt.summary || '(no title)',
          value: shortLine(evt),
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      // Special-case the common “insufficient scopes” error to guide the user
      const msg = String(err?.message || err);
      if (msg.includes('insufficient authentication scopes')) {
        return interaction.editReply(
          [
            'Permission error: the current Google authorization is missing calendar read scope.',
            'Please re-link with `/link-calendar` and approve access. If you still see this, remove the app from',
            'https://myaccount.google.com/permissions and try again.',
          ].join(' ')
        );
      }

      console.error('Failed to fetch events:', err);
      await interaction.editReply('Failed to fetch events. Check logs for details.');
    }
  },
};

// Detailed format for the first event
function formatEvent(evt) {
  const start = evt.start?.dateTime || evt.start?.date;
  const end = evt.end?.dateTime || evt.end?.date;

  const startFmt = formatWhen(start, !!evt.start?.date);
  const endFmt = evt.start?.date ? '(all day)' : formatWhen(end, false);

  const loc = evt.location ? `\nLocation: ${evt.location}` : '';
  const link = evt.htmlLink ? `\n<${evt.htmlLink}>` : '';

  return `**${evt.summary || '(no title)'}**\n${startFmt} → ${endFmt}${loc}${link}`;
}

// Compact format for embed fields
function shortLine(evt) {
  const start = evt.start?.dateTime || evt.start?.date;
  const end = evt.end?.dateTime || evt.end?.date;

  const startFmt = formatWhen(start, !!evt.start?.date);
  const endFmt = evt.start?.date ? '(all day)' : formatWhen(end, false);

  const loc = evt.location ? ` — ${evt.location}` : '';
  const link = evt.htmlLink ? `\n<${evt.htmlLink}>` : '';

  return `${startFmt} → ${endFmt}${loc}${link}`;
}

// Helper: consistent time formatting, handles all-day dates
function formatWhen(isoStringOrDateOnly, isAllDay) {
  // If all-day (date only), dayjs formats without time
  return isAllDay
    ? dayjs(isoStringOrDateOnly).format('MMM D')
    : dayjs(isoStringOrDateOnly).format('MMM D, HH:mm');
}
