// src/commands/calander/my-events.js  (command name = /events)
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dayjs = require('dayjs');
const { db, getUserCalendar, getPublicCalendarForUser } = require('../../db');
const { listUpcomingEvents, refreshIfNeeded } = require('./google');

function line(evt) {
  const s = evt.start?.dateTime || evt.start?.date;
  const e = evt.end?.dateTime || evt.end?.date;
  const sFmt = dayjs(s).isValid() ? dayjs(s).format('MMM D, HH:mm') : String(s);
  const eFmt = evt.start?.date ? '(all day)' : (dayjs(e).isValid() ? dayjs(e).format('MMM D, HH:mm') : String(e));
  const loc = evt.location ? ` — ${evt.location}` : '';
  const link = evt.htmlLink ? `\n<${evt.htmlLink}>` : '';
  return `${evt.summary || '(no title)'}\n${sFmt} → ${eFmt}${loc}${link}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('Show upcoming events (yours or another user’s public calendar)')
    .addUserOption(o => o.setName('user').setDescription('Another user (must be public)').setRequired(false))
    .addIntegerOption(o => o.setName('count').setDescription('How many (default 5)').setMinValue(1).setMaxValue(20).setRequired(false))
    .addStringOption(o => o.setName('provider').setDescription('google (default), microsoft (future)').addChoices(
      { name: 'google', value: 'google' },
      { name: 'microsoft', value: 'microsoft' },
    ).setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('user') || interaction.user;
    const count = interaction.options.getInteger('count') || 5;
    const provider = interaction.options.getString('provider') || 'google';

    if (provider !== 'google') {
      return interaction.editReply('Only google is supported right now.');
    }

    let row;
    if (target.id === interaction.user.id) {
      row = getUserCalendar(target.id, 'google');
    } else {
      row = getPublicCalendarForUser(target.id, 'google');
    }

    if (!row) {
      return interaction.editReply(
        target.id === interaction.user.id
          ? 'No active Google calendar found. Use `/set-calendar` or link your calendar.'
          : 'That user has no public Google calendar linked.'
      );
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
      const events = await listUpcomingEvents(tokens, row.calendar_id, { maxResults: count });
      if (!events.length) return interaction.editReply('No upcoming events.');

      const embed = new EmbedBuilder()
        .setTitle(`${target.username} — upcoming events`)
        .setDescription(line(events[0]))
        .setTimestamp(new Date());

      for (const evt of events.slice(1)) {
        embed.addFields({ name: evt.summary || '(no title)', value: line(evt) });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error('events error:', e);
      return interaction.editReply('Failed to fetch events.');
    }
  },
};
