const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bot.db'));

db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS calendars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  provider TEXT NOT NULL,                 -- 'google'
  calendar_id TEXT NOT NULL,              -- 'primary' or specific id
  access_token TEXT NOT NULL,
  refresh_token TEXT,                     -- may be null on refresh-less grants
  expires_at INTEGER NOT NULL,            -- ms since epoch
  visibility TEXT NOT NULL DEFAULT 'private', -- 'private' | 'public'
  UNIQUE(discord_user_id, provider, calendar_id)
);
`);

module.exports = {
  db,
  upsertCalendar(row) {
    const stmt = db.prepare(`
      INSERT INTO calendars (discord_user_id, provider, calendar_id, access_token, refresh_token, expires_at, visibility)
      VALUES (@discord_user_id, @provider, @calendar_id, @access_token, @refresh_token, @expires_at, @visibility)
      ON CONFLICT(discord_user_id, provider, calendar_id)
      DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, calendars.refresh_token),
        expires_at    = excluded.expires_at,
        visibility    = excluded.visibility
    `);
    stmt.run(row);
  },
  getUserCalendar(discord_user_id, provider='google') {
    return db.prepare(`SELECT * FROM calendars WHERE discord_user_id=? AND provider=? LIMIT 1`)
      .get(discord_user_id, provider);
  },
  getPublicCalendarsByUser(discord_user_id, provider='google') {
    return db.prepare(`SELECT * FROM calendars WHERE discord_user_id=? AND provider=? AND visibility='public'`)
      .all(discord_user_id, provider);
  }
};