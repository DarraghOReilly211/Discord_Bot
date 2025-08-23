// src/authServer.js
const express = require('express');
const { buildAuthUrl, exchangeCode } = require('./google');
const { db, upsertCalendar } = require('./db');

function startAuthServer(port = 3000) {
  const app = express();

  // Start Google OAuth for a specific Discord user
  app.get('/google/start', (req, res) => {
    const { discord_user_id, visibility } = req.query;
    if (!discord_user_id) return res.status(400).send('discord_user_id required');

    const url = buildAuthUrl({
      discord_user_id,
      visibility: visibility === 'public' ? 'public' : 'private',
    });
    return res.redirect(url);
  });

  // OAuth callback
  app.get('/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) return res.status(400).send('Missing code/state');

      const stateObj = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      const tokens = await exchangeCode(code); // { access_token, refresh_token, expiry_date, ... }

      // Save/Upsert tokens for this user on "primary"
      upsertCalendar({
        discord_user_id: stateObj.discord_user_id,
        provider: 'google',
        calendar_id: 'primary',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expiry_date || (Date.now() + 55 * 60 * 1000),
        visibility: stateObj.visibility || 'private',
      });

      // If no active calendar exists for this user/provider, make this one active
      const hasActive = db
        .prepare(
          `SELECT 1 FROM calendars WHERE discord_user_id=? AND provider='google' AND is_active=1 LIMIT 1`
        )
        .get(stateObj.discord_user_id);
      if (!hasActive) {
        db.prepare(
          `UPDATE calendars SET is_active=1 WHERE discord_user_id=? AND provider='google' AND calendar_id='primary'`
        ).run(stateObj.discord_user_id);
      }

      res.send('Google Calendar linked! You can close this tab and run /events or /create-event in Discord.');
    } catch (e) {
      console.error('OAuth error:', e);
      res.status(500).send('OAuth error. Check bot logs.');
    }
  });

  const server = app.listen(port, () => {
    console.log(`Auth server on http://localhost:${port}`);
  });
  return server;
}

module.exports = { startAuthServer };
