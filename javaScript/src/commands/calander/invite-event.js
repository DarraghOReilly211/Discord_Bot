// src/commands/calander/invite-event.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { getActiveCalendar, upsertCalendar, setRsvp, getRsvpSummary } = require('../../db');
const { refreshIfNeeded } = require('./google');

// Ensure fetch exists across Node versions
const fetch = globalThis.fetch ?? ((...args) =>
  import('node-fetch').then(({ default: f }) => f(...args))
);

function fmtRange(evt) {
  const s = evt.start?.dateTime || evt.start?.date;
  const e = evt.end?.dateTime || evt.end?.date;
  const isAllDay = !!evt.start?.date;
  const d = (x) => {
    const dt = new Date(x);
    if (Number.isNaN(dt.getTime())) return String(x);
    return dt.toLocaleString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: isAllDay ? undefined : '2-digit',
      minute: isAllDay ? undefined : '2-digit',
    });
  };
  return isAllDay ? `${d(s)} (all day)` : `${d(s)} → ${d(e)}`;
}

async function fetchGoogleEvent(tokens, calendarId, eventId) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(eventId)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google getEvent failed: ${res.status} ${txt}`);
  }
  return res.json(); // includes summary, location, htmlLink, start, end, etc.
}

function makeInviteEmbed({ title, when, location, url, hostTag, rsvpCounts }) {
  const embed = new EmbedBuilder()
    .setTitle(title || 'Event Invitation')
    .setTimestamp(new Date());

  const lines = [];
  if (when) lines.push(`**When:** ${when}`);
  if (location) lines.push(`**Location:** ${location}`);
  if (url) lines.push(`**Link:** <${url}>`);
  if (rsvpCounts) lines.push(`**RSVPs:** 👍 ${rsvpCounts.yes}  •  👎 ${rsvpCounts.no}`);
  embed.setDescription(lines.join('\n') || '(details unknown)');

  if (hostTag) embed.setFooter({ text: `Hosted by ${hostTag}` });
  return embed;
}

function linkRow(label, url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url)
  );
}

function rsvpRow(provider, calendarId, eventId, guildId) {
  const base = `rsvp|${provider}|${encodeURIComponent(calendarId)}|${encodeURIComponent(eventId)}|${guildId || ''}`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${base}|yes`).setLabel('👍 RSVP Yes').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${base}|no`).setLabel('👎 RSVP No').setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite-event')
    .setDescription('Invite people to an event via channel post or DMs')

    .addStringOption((o) =>
      o
        .setName('mode')
        .setDescription('How to send the invite')
        .addChoices(
          { name: 'global (post in channel)', value: 'global' },
          { name: 'private (DM one user)', value: 'private' },
          { name: 'silent (DM selected users)', value: 'silent' }
        )
        .setRequired(true)
    )

    // Either pass event_url OR (calendar_id + event_id) for Google
    .addStringOption((o) => o.setName('event_url').setDescription('Direct link to the event (any provider)').setRequired(false))
    .addStringOption((o) => o.setName('calendar_id').setDescription('Google calendarId').setRequired(false))
    .addStringOption((o) => o.setName('event_id').setDescription('Google eventId').setRequired(false))
    .addStringOption((o) =>
      o.setName('provider').setDescription('Provider (default: google)').addChoices({ name: 'Google', value: 'google' }).setRequired(false)
    )

    .addBooleanOption(o => o.setName('rsvp').setDescription('Include RSVP buttons (requires calendar_id + event_id)').setRequired(false))
    .addStringOption((o) => o.setName('title').setDescription('Custom title to display').setRequired(false))
    .addStringOption((o) => o.setName('note').setDescription('Short note to include with the invite').setRequired(false))

    // private mode
    .addUserOption((o) => o.setName('user').setDescription('User to DM (private mode)').setRequired(false))

    // silent mode: up to 10 users
    .addUserOption((o) => o.setName('user1').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user2').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user3').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user4').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user5').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user6').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user7').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user8').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user9').setDescription('Recipient (silent mode)').setRequired(false))
    .addUserOption((o) => o.setName('user10').setDescription('Recipient (silent mode)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const mode = interaction.options.getString('mode', true);
      const event_url = interaction.options.getString('event_url') || null;
      const calendar_id = interaction.options.getString('calendar_id') || null;
      const event_id = interaction.options.getString('event_id') || null;
      const provider = (interaction.options.getString('provider') || 'google').toLowerCase();
      const withRsvp = interaction.options.getBoolean('rsvp') || false;
      const customTitle = interaction.options.getString('title') || null;
      const note = interaction.options.getString('note') || null;
      const hostTag = `${interaction.user.username}`;

      // Gather recipients
      const privateUser = interaction.options.getUser('user') || null;
      const silentUsers = [];
      for (let i = 1; i <= 10; i++) {
        const u = interaction.options.getUser(`user${i}`);
        if (u) silentUsers.push(u);
      }

      // Resolve event details and link
      let evtTitle = customTitle;
      let evtWhen = null;
      let evtLocation = null;
      let link = event_url;

      if (!link && calendar_id && event_id) {
        if (provider !== 'google') {
          return interaction.editReply(
            'Only Google is supported when using calendar_id + event_id. Provide event_url for other providers.'
          );
        }
        const row = getActiveCalendar(interaction.user.id, 'google');
        if (!row) {
          return interaction.editReply(
            'No active Google calendar found. Use `/link-calendar provider:Google` first, or `/set-calendar`.'
          );
        }
        const refreshed = await refreshIfNeeded(row);
        upsertCalendar(refreshed);

        const tokens = {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expiry_date: refreshed.expires_at,
        };

        const event = await fetchGoogleEvent(tokens, calendar_id, event_id);
        link = event.htmlLink || link;
        evtTitle = evtTitle || event.summary || '(no title)';
        evtLocation = event.location || null;
        evtWhen = fmtRange(event);
      }

      if (!link) {
        return interaction.editReply(
          'Please provide either `event_url` or `calendar_id` + `event_id` (Google).'
        );
      }

      const embed = makeInviteEmbed({
        title: evtTitle || 'Event Invitation',
        when: evtWhen,
        location: evtLocation,
        url: link,
        hostTag,
        rsvpCounts: withRsvp && calendar_id && event_id ? getRsvpSummary(provider, calendar_id, event_id, interaction.guildId) : null,
      });

      const rows = [linkRow('Open event', link)];
      if (withRsvp && calendar_id && event_id) {
        rows.push(rsvpRow(provider, calendar_id, event_id, interaction.guildId));
      }

      const contentBase = note
        ? `📅 **Event invite** from **${hostTag}**\n${note}`
        : `📅 **Event invite** from **${hostTag}**`;

      if (mode === 'global') {
        if (!interaction.channel) {
          return interaction.editReply('Cannot post in this channel.');
        }
        await interaction.channel.send({ content: contentBase, embeds: [embed], components: rows });
        return interaction.editReply(withRsvp ? 'Invite posted (RSVP enabled).' : 'Invite posted.');
      }

      if (mode === 'private') {
        if (!privateUser) return interaction.editReply('Select a `user` to DM for private mode.');
        try {
          const dm = await privateUser.createDM();
          await dm.send({ content: contentBase, embeds: [embed], components: rows });
          return interaction.editReply(`Invite sent to ${privateUser.tag}.`);
        } catch (e) {
          console.error('DM (private) failed:', e);
          return interaction.editReply(`I couldn't DM ${privateUser.tag}. They may have DMs closed.`);
        }
      }

      if (mode === 'silent') {
        if (silentUsers.length === 0) {
          return interaction.editReply('Add at least one recipient (user1..user10) for silent mode.');
        }
        let ok = 0, fail = 0;
        for (const u of silentUsers) {
          try {
            const dm = await u.createDM();
            await dm.send({ content: contentBase, embeds: [embed], components: rows });
            ok++;
          } catch (e) {
            console.error('DM (silent) failed for', u.tag, e);
            fail++;
          }
        }
        return interaction.editReply(`Silent invites sent. ✅ ${ok} delivered${fail ? `, ❌ ${fail} failed` : ''}.`);
      }

      return interaction.editReply('Unknown mode.');
    } catch (err) {
      console.error('invite-event error:', err);
      return interaction.editReply('Failed to send the invite. Check the inputs and try again.');
    }
  },
};
