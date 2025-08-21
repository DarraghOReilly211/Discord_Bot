const express = require('express');
const dayjs = require('dayjs');
const { buildAuthUrl, exchangeCode } = require('./google');
const { upsertCalendar } = require('./db');

function startAuthServer() {
  const app = express();

  // Start Google OAuth for a specific Discord user
  app.get('/google/start', (req, res) => {
    const { discord_user_id, visibility } = req.query;
    if (!discord_user_id) return res.status(400).send('discord_user_id required');
    const url = buildAuthUrl({ discord_user_id, visibility: visibility === 'public' ? 'public' : 'private' });
    res.redirect(url);
  });

  // OAuth callback
  app.get('/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      const stateObj = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      const tokens = await exchangeCode(code);

      upsertCalendar({
        discord_user_id: stateObj.discord_user_id,
        provider: 'google',
        calendar_id: 'primary',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expiry_date || (Date.now() + 55*60*1000),
        visibility: stateObj.visibility || 'private'
      });

      res.send('Google Calendar linked! You can close this tab and run /my-events in Discord.');
    } catch (e) {
      console.error(e);
      res.status(500).send('OAuth error. Check bot logs.');
    }
  });

  const server = app.listen(3000, () => {
    console.log('Auth server on http://localhost:3000');
  });

  return server;
}

module.exports = { startAuthServer };
