const dayjs = require('dayjs');
const { db, getReminderSettings, getUserCalendar, markReminderSent } = require('../db');
const { listUpcomingEvents, refreshIfNeeded } = require('../commands/calander/google');

async function checkUserReminders(client, userId) {
  const settings = getReminderSettings(userId);
  if (!settings || !settings.enabled) return;

  const row = getUserCalendar(userId, settings.provider || 'google');
  if (!row) return;

  const now = Date.now();
  const leadMs = (settings.lead_minutes || 15) * 60 * 1000;
  const windowStart = Math.floor(now / 60_000) * 60_000; // minute bucket

  try {
    const refreshed = await refreshIfNeeded(row);
    if (refreshed.expires_at !== row.expires_at || refreshed.access_token !== row.access_token) {
      db.prepare(`UPDATE calendars SET access_token=?, refresh_token=?, expires_at=? WHERE id=?`)
        .run(refreshed.access_token, refreshed.refresh_token, refreshed.expires_at, refreshed.id);
    }

    const tokens = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expiry_date: refreshed.expires_at,
    };
    const events = await listUpcomingEvents(tokens, refreshed.calendar_id, { maxResults: 10 });

    const upcoming = events.filter(evt => {
      const start = evt.start?.dateTime || evt.start?.date;
      if (!start) return false;
      const ts = dayjs(start).valueOf();
      return ts >= now && ts <= now + leadMs;
    });

    if (!upcoming.length) return;

    const user = await client.users.fetch(userId).catch(() => null);
    const channel = settings.notify_channel_id
      ? await client.channels.fetch(settings.notify_channel_id).catch(() => null)
      : null;

    for (const evt of upcoming) {
      const evId = evt.id || evt.iCalUID || `${evt.summary}-${evt.start?.dateTime || evt.start?.date}`;
      const dedup = markReminderSent({
        discord_user_id: userId,
        provider: 'google',
        calendar_id: refreshed.calendar_id,
        event_id: evId,
        window_start: windowStart,
      });
      if (!dedup) continue; // already sent this minute

      const title = evt.summary || '(no title)';
      const startFmt = dayjs(evt.start?.dateTime || evt.start?.date).format('MMM D, HH:mm');
      const link = evt.htmlLink ? `\n${evt.htmlLink}` : '';

      const text = `Reminder: "${title}" at ${startFmt}${link}`;

      if (user) {
        await user.send(text).catch(() => {});
      }
      if (channel) {
        const roleMention = settings.notify_role_id ? `<@&${settings.notify_role_id}> ` : '';
        await channel.send(`${roleMention}${text}`).catch(() => {});
      }
    }
  } catch (e) {
    // silent per-user error
  }
}

function startReminderWorker(client) {
  setInterval(async () => {
    // pull all users who have reminder_settings rows
    const rows = db.prepare(`SELECT discord_user_id FROM reminder_settings WHERE enabled=1`).all();
    await Promise.all(rows.map(r => checkUserReminders(client, r.discord_user_id)));
  }, 60_000);
}

module.exports = { startReminderWorker };
