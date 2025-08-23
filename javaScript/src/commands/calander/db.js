// src/db.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bot.db'));
db.pragma('journal_mode = WAL');

// Calendars table
db.exec(`
CREATE TABLE IF NOT EXISTS calendars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  UNIQUE(discord_user_id, provider, calendar_id)
);
`);

// Add is_active if missing (safe migration)
try {
  db.exec(`ALTER TABLE calendars ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;`);
} catch { /* already exists */ }

// Levels, per guild
db.exec(`
CREATE TABLE IF NOT EXISTS levels (
  discord_user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (discord_user_id, guild_id)
);
`);

const getLevelRow = db.prepare(
  'SELECT level, xp FROM levels WHERE discord_user_id=? AND guild_id=?'
);
const insertLevelRow = db.prepare(
  'INSERT INTO levels (discord_user_id, guild_id, level, xp) VALUES (?, ?, 1, 0)'
);
const updateLevelRow = db.prepare(
  'UPDATE levels SET level=?, xp=? WHERE discord_user_id=? AND guild_id=?'
);
const topRowsByGuild = db.prepare(
  'SELECT discord_user_id, level, xp FROM levels WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT ?'
);

function ensureLevelRow(discord_user_id, guild_id) {
  let row = getLevelRow.get(discord_user_id, guild_id);
  if (!row) {
    insertLevelRow.run(discord_user_id, guild_id);
    row = { level: 1, xp: 0 };
  }
  return row;
}

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

  updateLevelRow.run(level, xp, discord_user_id, guild_id);
  return { level, xp, leveledUp, levelsGained };
}

function getUserLevel(discord_user_id, guild_id) {
  const row = ensureLevelRow(discord_user_id, guild_id);
  return row;
}

function getLeaderboard(guild_id, limit = 10) {
  return topRowsByGuild.all(guild_id, limit);
}

// Calendar helpers
function getUserCalendar(discord_user_id, provider) {
  return db
    .prepare(
      `SELECT * FROM calendars
       WHERE discord_user_id=? AND provider=? AND is_active=1
       LIMIT 1`
    )
    .get(discord_user_id, provider);
}

function getPublicCalendarForUser(discord_user_id, provider) {
  return db
    .prepare(
      `SELECT * FROM calendars
       WHERE discord_user_id=? AND provider=? AND visibility='public' AND is_active=1
       LIMIT 1`
    )
    .get(discord_user_id, provider);
}

module.exports = {
  db,

  // calendars
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
  getUserCalendar,
  getPublicCalendarForUser,

  // leveling api
  addXp,
  getUserLevel,
  getLeaderboard,
};
