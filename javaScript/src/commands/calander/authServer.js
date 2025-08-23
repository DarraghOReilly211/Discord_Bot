// src/commands/calander/authServer.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const express = require('express');
const { google } = require('googleapis');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { db, upsertCalendar } = require('./db');

// --------- Google OAuth2 ---------
const googleOAuth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT || `http://localhost:${process.env.AUTH_PORT || 3000}/google/callback`
);

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'openid', 'email', 'profile',
];

// --------- Microsoft OAuth2 (Auth Code) ---------
const MS_TENANT = process.env.MS_TENANT_ID || 'common';
const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const MS_REDIRECT = process.env.MS_REDIRECT || `http://localhost:${process.env.AUTH_PORT || 3000}/microsoft/callback`;

const MS_AUTH_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
const MS_TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;

const MS_SCOPES = [
  'offline_access',
  'https://graph.microsoft.com/Calendars.ReadWrite',
];

// --------- server bootstrap ---------
let server;

function startAuthServer(port = 3000) {
  if (server) return server; // already running

  const app = express();

  // Simple health
  app.get('/healthz', (_, res) => res.send('ok'));

  // ===== GOOGLE =====
  app.get('/google/start', (req, res) => {
    const { discord_user_id, visibility = 'private' } = req.query;
    if (!discord_user_id) return res.status(400).send('discord_user_id required');

    // encode the state so we can get the discord_user_id and visibility back
    const state = Buffer.from(JSON.stringify({ discord_user_id, visibility }), 'utf8').toString('base64url');

    const url = googleOAuth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state,
    });
    res.redirect(url);
  });

  app.get('/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) return res.status(400).send('Missing code/state');

      const stateObj = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));

      const { tokens } = await googleOAuth2.getToken(String(code));
      // tokens: { access_token, refresh_token, expiry_date, ... }
      const expires_at = tokens.expiry_date || (Date.now() + 55 * 60 * 1000);

      // Upsert for this user’s “primary” calendar
      upsertCalendar({
        discord_user_id: stateObj.discord_user_id,
        provider: 'google',
        calendar_id: 'primary',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at,
        visibility: stateObj.visibility || 'private',
      });

      // If none is active for this provider, make this one active
      const hasActive = db.prepare(
        `SELECT 1 FROM calendars WHERE discord_user_id=? AND provider='google' AND is_active=1 LIMIT 1`
      ).get(stateObj.discord_user_id);

      if (!hasActive) {
        db.prepare(
          `UPDATE calendars SET is_active=1 WHERE discord_user_id=? AND provider='google' AND calendar_id='primary'`
        ).run(stateObj.discord_user_id);
      }

      res.send('Google Calendar linked. You can close this tab and return to Discord.');
    } catch (e) {
      console.error('Google OAuth error:', e);
      res.status(500).send('Google linking failed; check bot logs.');
    }
  });

  // ===== MICROSOFT =====
  app.get('/microsoft/start', (req, res) => {
    const { discord_user_id, visibility = 'private' } = req.query;
    if (!discord_user_id) return res.status(400).send('discord_user_id required');

    const state = Buffer.from(JSON.stringify({ discord_user_id, visibility }), 'utf8').toString('base64url');

    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      response_type: 'code',
      redirect_uri: MS_REDIRECT,
      response_mode: 'query',
      scope: MS_SCOPES.join(' '),
      state,
    });

    res.redirect(`${MS_AUTH_URL}?${params.toString()}`);
  });

  app.get('/microsoft/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) return res.status(400).send('Missing code/state');

      const stateObj = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));

      // Exchange auth code for tokens
      const body = new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: MS_REDIRECT,
        scope: MS_SCOPES.join(' '),
        code: String(code),
      });

      const tokenRes = await fetch(MS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!tokenRes.ok) {
        const txt = await tokenRes.text();
        console.error('MS token error:', tokenRes.status, txt);
        return res.status(500).send('Microsoft token exchange failed');
      }

      const tokens = await tokenRes.json();
      // tokens: { access_token, refresh_token, expires_in, token_type, ... }
      const expires_at = Date.now() + (tokens.expires_in ? tokens.expires_in * 1000 : 55 * 60 * 1000);

      // Upsert as “primary”; you can later add a /list-calendars to let users pick a specific one.
      upsertCalendar({
        discord_user_id: stateObj.discord_user_id,
        provider: 'microsoft',
        calendar_id: 'primary',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at,
        visibility: stateObj.visibility || 'private',
      });

      // Mark active if none exists yet for Microsoft
      const hasActive = db.prepare(
        `SELECT 1 FROM calendars WHERE discord_user_id=? AND provider='microsoft' AND is_active=1 LIMIT 1`
      ).get(stateObj.discord_user_id);

      if (!hasActive) {
        db.prepare(
          `UPDATE calendars SET is_active=1 WHERE discord_user_id=? AND provider='microsoft' AND calendar_id='primary'`
        ).run(stateObj.discord_user_id);
      }

      res.send('Microsoft Calendar linked. You can close this tab and return to Discord.');
    } catch (e) {
      console.error('Microsoft OAuth error:', e);
      res.status(500).send('Microsoft linking failed; check bot logs.');
    }
  });

  server = app.listen(port, () => {
    console.log(`Auth server listening on http://localhost:${port}`);
  });

  return server;
}

module.exports = { startAuthServer };
