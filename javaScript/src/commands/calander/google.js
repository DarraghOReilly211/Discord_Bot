const { google } = require('googleapis');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Build consent URL with Discord user/state
function buildAuthUrl({ discord_user_id, visibility='private' }) {
  const oauth = getOAuthClient();
  const state = Buffer.from(JSON.stringify({ discord_user_id, visibility })).toString('base64url');
  return oauth.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly','openid','email'],
    prompt: 'consent',
    state
  });
}

async function exchangeCode(code) {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, ... }
}

function clientFromTokens(tokens) {
  const oauth = getOAuthClient();
  oauth.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: oauth });
}

async function listUpcomingEvents(tokens, calendarId='primary', { maxResults=5 }={}) {
  const calendar = clientFromTokens(tokens);
  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults
  });
  return res.data.items || [];
}

async function refreshIfNeeded(row) {
  // If access token is near expiry, refresh using refresh_token
  const now = Date.now();
  if (!row.refresh_token) return row; // cannot refresh

  if (now < row.expires_at - 60_000) return row; // still valid

  const oauth = getOAuthClient();
  oauth.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: row.expires_at
  });
  const { credentials } = await oauth.refreshAccessToken();
  return {
    ...row,
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token || row.refresh_token,
    expires_at: credentials.expiry_date
  };
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  listUpcomingEvents,
  refreshIfNeeded
};
