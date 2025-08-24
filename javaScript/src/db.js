// src/db.js
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'bot.db'));
db.pragma('journal_mode = WAL');

/* ---------- Schema ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS calendars (
  discord_user_id TEXT NOT NULL,
  provider        TEXT NOT NULL CHECK(provider IN ('google','microsoft')),
  calendar_id     TEXT NOT NULL,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  expires_at      INTEGER NOT NULL, -- ms epoch
  visibility      TEXT NOT NULL DEFAULT 'private',
  is_active       INTEGER NOT NULL DEFAULT 0, -- 0/1
  PRIMARY KEY (discord_user_id, provider, calendar_id)
);

CREATE TABLE IF NOT EXISTS reminder_settings (
  discord_user_id TEXT NOT NULL,
  lead_minutes    INTEGER NOT NULL DEFAULT 15,
  channel_id      TEXT,
  role_id         TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (discord_user_id)
);

CREATE TABLE IF NOT EXISTS digest_settings (
  discord_user_id TEXT NOT NULL,
  frequency       TEXT NOT NULL CHECK (frequency IN ('daily','weekly')),
  hour_utc        INTEGER NOT NULL DEFAULT 9,  -- 0..23
  enabled         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (discord_user_id)
);

CREATE TABLE IF NOT EXISTS levels (
  discord_user_id TEXT NOT NULL,
  guild_id        TEXT NOT NULL,
  level           INTEGER NOT NULL DEFAULT 1,
  xp              INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (discord_user_id, guild_id)
);

/* RSVP tracking per event per user */
CREATE TABLE IF NOT EXISTS rsvps (
  guild_id        TEXT,
  event_provider  TEXT NOT NULL CHECK(event_provider IN ('google','microsoft')),
  calendar_id     TEXT NOT NULL,
  event_id        TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  status          TEXT NOT NULL CHECK(status IN ('yes','no')),
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (event_provider, calendar_id, event_id, discord_user_id, guild_id)
);
`);

/* ---------- Calendars ---------- */
const stmtUpsertCalendar = db.prepare(`
INSERT INTO calendars (
  discord_user_id, provider, calendar_id,
  access_token, refresh_token, expires_at,
  visibility, is_active
) VALUES (
  @discord_user_id, @provider, @calendar_id,
  @access_token, @refresh_token, @expires_at,
  COALESCE(@visibility,'private'), COALESCE(@is_active,0)
)
ON CONFLICT(discord_user_id, provider, calendar_id) DO UPDATE SET
  access_token = excluded.access_token,
  refresh_token = COALESCE(excluded.refresh_token, calendars.refresh_token),
  expires_at = excluded.expires_at,
  visibility = excluded.visibility,
  is_active = COALESCE(excluded.is_active, calendars.is_active)
`);

function upsertCalendar(row) {
  // Ensure *all* named params exist so better-sqlite3 doesn't throw
  const toRun = {
    visibility: 'private',
    is_active: 0,
    refresh_token: null,
    ...row,
  };
  stmtUpsertCalendar.run(toRun);
}

const stmtSetAllInactive = db.prepare(`
UPDATE calendars SET is_active=0 WHERE discord_user_id=? AND provider=?
`);
const stmtActivate = db.prepare(`
UPDATE calendars SET is_active=1
WHERE discord_user_id=? AND provider=? AND calendar_id=?
`);
function setActiveCalendar(discord_user_id, provider, calendar_id) {
  const tx = db.transaction((uid, prov, calId) => {
    stmtSetAllInactive.run(uid, prov);
    stmtActivate.run(uid, prov, calId);
  });
  tx(discord_user_id, provider, calendar_id);
}

const stmtGetActive = db.prepare(`
SELECT *
FROM calendars
WHERE discord_user_id=? AND provider=? AND is_active=1
LIMIT 1
`);
function getActiveCalendar(discord_user_id, provider) {
  return stmtGetActive.get(discord_user_id, provider) || null;
}

// Convenience alias for legacy callers
function getUserCalendar(discord_user_id, provider) {
  return getActiveCalendar(discord_user_id, provider);
}

// Public active calendar for another user
const stmtGetPublicActive = db.prepare(`
SELECT *
FROM calendars
WHERE discord_user_id=? AND provider=? AND visibility='public' AND is_active=1
LIMIT 1
`);
function getPublicCalendarForUser(discord_user_id, provider) {
  return stmtGetPublicActive.get(discord_user_id, provider) || null;
}

/* unlink provider (remove all rows for that user+provider) */
const stmtUnlinkProvider = db.prepare(`
DELETE FROM calendars WHERE discord_user_id=? AND provider=?
`);
function unlinkProvider(discord_user_id, provider) {
  const info = stmtUnlinkProvider.run(discord_user_id, provider);
  return info.changes || 0;
}

/* set visibility of active calendar for a provider */
const stmtSetVisibilityActive = db.prepare(`
UPDATE calendars SET visibility=?
WHERE discord_user_id=? AND provider=? AND is_active=1
`);
function setActiveVisibility(discord_user_id, provider, visibility) {
  const info = stmtSetVisibilityActive.run(visibility, discord_user_id, provider);
  return info.changes || 0;
}

/* whoami helpers */
const stmtCountPerProvider = db.prepare(`
SELECT provider, COUNT(*) AS n
FROM calendars
WHERE discord_user_id=?
GROUP BY provider
`);
const stmtActiveSummaries = db.prepare(`
SELECT provider, calendar_id, visibility
FROM calendars
WHERE discord_user_id=? AND is_active=1
`);
function getLinkSummary(discord_user_id) {
  const counts = stmtCountPerProvider.all(discord_user_id);
  const active = stmtActiveSummaries.all(discord_user_id);
  return { counts, active };
}

/* ---------- Reminders ---------- */
const stmtUpsertReminder = db.prepare(`
INSERT INTO reminder_settings (
  discord_user_id, lead_minutes, channel_id, role_id, enabled
) VALUES (
  @discord_user_id, COALESCE(@lead_minutes,15), @channel_id, @role_id, COALESCE(@enabled,1)
)
ON CONFLICT(discord_user_id) DO UPDATE SET
  lead_minutes = COALESCE(excluded.lead_minutes, reminder_settings.lead_minutes),
  channel_id   = COALESCE(excluded.channel_id,   reminder_settings.channel_id),
  role_id      = COALESCE(excluded.role_id,      reminder_settings.role_id),
  enabled      = COALESCE(excluded.enabled,      reminder_settings.enabled)
`);
function saveReminderSettings({ discord_user_id, lead_minutes, channel_id, role_id, enabled }) {
  stmtUpsertReminder.run({ discord_user_id, lead_minutes, channel_id, role_id, enabled });
}

const stmtGetReminder = db.prepare(`
SELECT * FROM reminder_settings WHERE discord_user_id=? LIMIT 1
`);
function getReminderSettings(discord_user_id) {
  return stmtGetReminder.get(discord_user_id) || { lead_minutes: 15, enabled: 1 };
}

/* ---------- Digests ---------- */
const stmtUpsertDigest = db.prepare(`
INSERT INTO digest_settings (discord_user_id, frequency, hour_utc, enabled)
VALUES (@discord_user_id, @frequency, COALESCE(@hour_utc, 9), COALESCE(@enabled,1))
ON CONFLICT(discord_user_id) DO UPDATE SET
  frequency = excluded.frequency,
  hour_utc  = excluded.hour_utc,
  enabled   = excluded.enabled
`);
function upsertDigestSetting({ discord_user_id, frequency, hour_utc, enabled }) {
  stmtUpsertDigest.run({ discord_user_id, frequency, hour_utc, enabled });
}

const stmtGetDigest = db.prepare(`
SELECT * FROM digest_settings WHERE discord_user_id=? LIMIT 1
`);
function getDigestSetting(discord_user_id) {
  return stmtGetDigest.get(discord_user_id) || null;
}

/* ---------- RSVPs ---------- */
const stmtUpsertRsvp = db.prepare(`
INSERT INTO rsvps (guild_id, event_provider, calendar_id, event_id, discord_user_id, status, updated_at)
VALUES (@guild_id, @event_provider, @calendar_id, @event_id, @discord_user_id, @status, @updated_at)
ON CONFLICT(event_provider, calendar_id, event_id, discord_user_id, guild_id)
DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at
`);
function setRsvp({ guild_id, event_provider, calendar_id, event_id, discord_user_id, status }) {
  stmtUpsertRsvp.run({
    guild_id: guild_id || null,
    event_provider,
    calendar_id,
    event_id,
    discord_user_id,
    status,
    updated_at: Date.now(),
  });
}

const stmtCountRsvp = db.prepare(`
SELECT status, COUNT(*) AS c
FROM rsvps
WHERE event_provider=? AND calendar_id=? AND event_id=? AND (guild_id=? OR ? IS NULL)
GROUP BY status
`);
function getRsvpSummary(event_provider, calendar_id, event_id, guild_id = null) {
  const rows = stmtCountRsvp.all(event_provider, calendar_id, event_id, guild_id, guild_id);
  const out = { yes: 0, no: 0 };
  for (const r of rows) {
    if (r.status === 'yes') out.yes = r.c;
    else if (r.status === 'no') out.no = r.c;
  }
  return out;
}

/* ---------- Levels ---------- */
const stmtGetLevel = db.prepare(`
SELECT level, xp FROM levels WHERE discord_user_id=? AND guild_id=?
`);
const stmtInsertLevel = db.prepare(`
INSERT INTO levels (discord_user_id, guild_id, level, xp)
VALUES (?, ?, 1, 0)
`);
const stmtUpdateLevel = db.prepare(`
UPDATE levels SET level=?, xp=? WHERE discord_user_id=? AND guild_id=?
`);
const stmtTopByGuild = db.prepare(`
SELECT discord_user_id, level, xp
FROM levels
WHERE guild_id=?
ORDER BY level DESC, xp DESC
LIMIT ?
`);

function ensureLevelRow(discord_user_id, guild_id) {
  let row = stmtGetLevel.get(discord_user_id, guild_id);
  if (!row) {
    stmtInsertLevel.run(discord_user_id, guild_id);
    row = { level: 1, xp: 0 };
  }
  return row;
}

/**
 * @param {string} discord_user_id
 * @param {string} guild_id
 * @param {number} xpToAdd
 * @param {(level:number)=>number} xpForLevelFn
 */
function addXp(discord_user_id, guild_id, xpToAdd, xpForLevelFn) {
  const row = ensureLevelRow(discord_user_id, guild_id);
  let { level, xp } = row;
  xp += xpToAdd;

  let leveledUp = false;
  let levelsGained = 0;
  while (xp >= xpForLevelFn(level)) {
    xp -= xpForLevelFn(level);
    level += 1;
    leveledUp = true;
    levelsGained += 1;
  }

  stmtUpdateLevel.run(level, xp, discord_user_id, guild_id);
  return { level, xp, leveledUp, levelsGained };
}

function getUserLevel(discord_user_id, guild_id) {
  return ensureLevelRow(discord_user_id, guild_id);
}

function getLeaderboard(guild_id, limit = 10) {
  return stmtTopByGuild.all(guild_id, limit);
}

module.exports = {
  db,

  // calendars
  upsertCalendar,
  setActiveCalendar,
  getActiveCalendar,
  getUserCalendar,
  getPublicCalendarForUser,
  unlinkProvider,
  setActiveVisibility,
  getLinkSummary,

  // reminders
  saveReminderSettings,
  getReminderSettings,

  // digests
  upsertDigestSetting,
  getDigestSetting,

  // RSVPs
  setRsvp,
  getRsvpSummary,

  // levels
  addXp,
  getUserLevel,
  getLeaderboard,
};
