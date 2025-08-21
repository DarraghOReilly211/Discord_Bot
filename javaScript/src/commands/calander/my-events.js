const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dayjs = require('dayjs');
const { db, getUserCalendar } = require('../../src/db');
const { listUpcomingEvents, refreshIfNeeded } = require('../../src/google');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-events')
    .setDescription('Show your upcoming Google Calendar events')
    .addIntegerOption(o =>
      o.setName('count')
       .setDescription('How many events (default 5)')
       .setMinValue(1).setMaxValue(20)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const count = interaction.options.getInteger('count') || 5;

    let row = getUserCalendar(interaction.user.id, 'google');
    if (!row) {
      return interaction.editReply('You have not linked your calendar yet. Use `/link-calendar`.');
    }

    // refresh tokens if needed
    try {
      row = await refreshIfNeeded(row);
      // persist refreshed tokens if changed
      db.prepare(`UPDATE calendars SET access_token=?, refresh_token=?, expires_at=? WHERE id=?`)
        .run(row.access_token, row.refresh_token, row.expires_at, row.id);
    } catch (e) {
      console.error(e);
      return interaction.editReply('Token refresh failed. Please run `/link-calendar` again.');
    }

    try {
      const tokens = { access_token: row.access_token, refresh_token: row.refresh_token, expiry_date: row.expires_at };
      const events = await listUpcomingEvents(tokens, row.calendar_id, { maxResults: count });

      if (!events.length) return interaction.editReply('No upcoming events.');

      const embed = new EmbedBuilder()
        .setTitle(`Your upcoming events`)
        .setTimestamp(new Date());

      const first = events[0];
      embed.setDescription(formatEvent(first));

      for (const evt of events.slice(1)) {
        embed.addFields({ name: evt.summary || '(no title)', value: shortLine(evt) });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      await interaction.editReply('Failed to fetch events. Check logs.');
    }
  }
};

function formatEvent(evt) {
  const start = evt.start.dateTime || evt.start.date;
  const end   = evt.end.dateTime   || evt.end.date;
  const startFmt = dayjs(start).format('MMM D, HH:mm');
  const endFmt   = evt.start.date ? '(all day)' : dayjs(end).format('MMM D, HH:mm');
  const loc = evt.location ? `\n ${evt.location}` : '';
  const link = evt.htmlLink ? `\n<${evt.htmlLink}>` : '';
  return `**${evt.summary || '(no title)'}**\n${startFmt} → ${endFmt}${loc}${link}`;
}
function shortLine(evt) {
  const start = evt.start.dateTime || evt.start.date;
  const end   = evt.end.dateTime   || evt.end.date;
  const startFmt = dayjs(start).format('MMM D, HH:mm');
  const endFmt   = evt.start.date ? '(all day)' : dayjs(end).format('MMM D, HH:mm');
  return `${startFmt} → ${endFmt}${evt.location ? ` — ${evt.location}` : ''}${evt.htmlLink ? `\n<${evt.htmlLink}>` : ''}`;
}
