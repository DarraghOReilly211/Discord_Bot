const { ConfidentialClientApplication } = require('@azure/msal-node');
require('isomorphic-fetch');
const { Client } = require('@microsoft/microsoft-graph-client');

const msalConfig = {
  auth: {
    clientId: process.env.MS_CLIENT_ID,
    authority: `https://login.microsoftonline.com/common`,
    clientSecret: process.env.MS_CLIENT_SECRET,
  },
};
const msScopes = ['https://graph.microsoft.com/Calendars.ReadWrite'];

function getMsal() { return new ConfidentialClientApplication(msalConfig); }

function getGraphClient(accessToken) {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

// Build an auth URL (device code or auth code w/ your own express handler)
// For brevity, this example assumes you store tokens similarly to Google.
// You can extend your authServer with /microsoft/start and /microsoft/callback.

async function listUpcomingEventsMs(access_token, calendarId = 'primary', max = 5) {
  const graph = getGraphClient(access_token);
  const res = await graph
    .api(`/me/calendars/${encodeURIComponent(calendarId)}/events`)
    .top(max)
    .orderby('start/dateTime')
    .get();
  return res.value || [];
}

async function createEventMs(access_token, calendarId, body) {
  const graph = getGraphClient(access_token);
  const res = await graph
    .api(`/me/calendars/${encodeURIComponent(calendarId)}/events`)
    .post({
      subject: body.summary,
      body: { contentType: 'HTML', content: body.description || '' },
      start: { dateTime: body.start.dateTime, timeZone: 'UTC' },
      end:   { dateTime: body.end.dateTime,   timeZone: 'UTC' },
      location: body.location ? { displayName: body.location } : undefined,
      recurrence: body.recurrence ? {
        pattern: body.recurrence === 'DAILY'
          ? { type: 'daily', interval: 1 }
          : { type: 'weekly', interval: 1, daysOfWeek: [new Date(body.start.dateTime).toLocaleString('en-US', { weekday: 'long' }).toLowerCase()] },
        range: { type: 'noEnd' }
      } : undefined,
    });
  return res;
}

async function deleteEventMs(access_token, calendarId, eventId) {
  const graph = getGraphClient(access_token);
  await graph.api(`/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`).delete();
  return true;
}

module.exports = {
  listUpcomingEventsMs,
  createEventMs,
  deleteEventMs,
  msScopes,
  getMsal,
};
