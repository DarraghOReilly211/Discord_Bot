// --- additions in src/db.js ---

// New helper to get all calendars for a user/provider
function listUserCalendars(discord_user_id, provider) {
  return db.prepare(`
    SELECT id, provider, calendar_id, visibility, is_active
    FROM calendars
    WHERE discord_user_id=? AND provider=?
    ORDER BY is_active DESC, calendar_id ASC
  `).all(discord_user_id, provider);
}

// Make sure "is_active" column exists (you may already have this)
try { db.exec(`ALTER TABLE calendars ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;`); } catch {}

// Reminders config: per user for lead-time notifications
db.exec(`
CREATE TABLE IF NOT EXISTS reminder_settings (
  discord_user_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'google',
  lead_minutes INTEGER NOT NULL DEFAULT 15,
  notify_channel_id TEXT,      -- optional; if null, DM only
  notify_role_id TEXT,         -- optional; @role ping in channel
  enabled INTEGER NOT NULL DEFAULT 1
);
`);

// Digest settings: daily/weekly digests with desired time
db.exec(`
CREATE TABLE IF NOT EXISTS digest_settings (
  discord_user_id TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly')),
  hour INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute INTEGER NOT NULL CHECK (minute BETWEEN 0 AND 59),
  last_sent_at INTEGER,  -- ms since epoch
  PRIMARY KEY (discord_user_id, frequency)
);
`);

// Idempotency table to avoid duplicate live reminders
db.exec(`
CREATE TABLE IF NOT EXISTS reminder_sent (
  discord_user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  window_start INTEGER NOT NULL, -- bucketed minute timestamp
  PRIMARY KEY (discord_user_id, provider, calendar_id, event_id, window_start)
);
`);

function setActiveCalendar(discord_user_id, provider, calendar_id, visibility) {
  const tx = db.transaction(() => {
    db.prepare(`UPDATE calendars SET is_active=0 WHERE discord_user_id=? AND provider=?`)
      .run(discord_user_id, provider);
    const res = db.prepare(`
      UPDATE calendars
      SET is_active=1, visibility=?
      WHERE discord_user_id=? AND provider=? AND calendar_id=?
    `).run(visibility, discord_user_id, provider, calendar_id);
    return res.changes;
  });
  return tx();
}

function saveReminderSettings({
  discord_user_id, provider = 'google', lead_minutes = 15,
  notify_channel_id = null, notify_role_id = null, enabled = 1,
}) {
  db.prepare(`
    INSERT INTO reminder_settings (discord_user_id, provider, lead_minutes, notify_channel_id, notify_role_id, enabled)
    VALUES (@discord_user_id, @provider, @lead_minutes, @notify_channel_id, @notify_role_id, @enabled)
    ON CONFLICT(discord_user_id)
    DO UPDATE SET
      provider=excluded.provider,
      lead_minutes=excluded.lead_minutes,
      notify_channel_id=excluded.notify_channel_id,
      notify_role_id=excluded.notify_role_id,
      enabled=excluded.enabled
  `).run({ discord_user_id, provider, lead_minutes, notify_channel_id, notify_role_id, enabled });
}

function getReminderSettings(discord_user_id) {
  return db.prepare(`SELECT * FROM reminder_settings WHERE discord_user_id=?`).get(discord_user_id);
}

function upsertDigestSetting({ discord_user_id, frequency, hour, minute }) {
  db.prepare(`
    INSERT INTO digest_settings (discord_user_id, frequency, hour, minute)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discord_user_id, frequency)
    DO UPDATE SET hour=excluded.hour, minute=excluded.minute
  `).run(discord_user_id, frequency, hour, minute);
}

function getDigestSettings() {
  return db.prepare(`SELECT * FROM digest_settings`).all();
}

function updateDigestLastSent(discord_user_id, frequency, ts) {
  db.prepare(`
    UPDATE digest_settings SET last_sent_at=? WHERE discord_user_id=? AND frequency=?
  `).run(ts, discord_user_id, frequency);
}

function markReminderSent({ discord_user_id, provider, calendar_id, event_id, window_start }) {
  try {
    db.prepare(`
      INSERT INTO reminder_sent (discord_user_id, provider, calendar_id, event_id, window_start)
      VALUES (?, ?, ?, ?, ?)
    `).run(discord_user_id, provider, calendar_id, event_id, window_start);
    return true;
  } catch {
    return false; // already sent in this window
  }
}

module.exports = {
  // ...your existing exports
  listUserCalendars,
  setActiveCalendar,
  saveReminderSettings,
  getReminderSettings,
  upsertDigestSetting,
  getDigestSettings,
  updateDigestLastSent,
  markReminderSent,
};
