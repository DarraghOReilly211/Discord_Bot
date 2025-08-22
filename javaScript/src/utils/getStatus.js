const { ActivityType } = require('discord.js');

// Use global fetch if available (Node 18+); otherwise fall back to node-fetch
const ensureFetch = () => {
  if (typeof fetch === 'function') return fetch;
  // Lazy import to avoid ESM hassle
  // npm i node-fetch if you need this path
  // eslint-disable-next-line global-require
  return (...args) => import('node-fetch').then(m => m.default(...args));
};
const _fetch = ensureFetch();

// ---- internal token cache ----
let twitchToken = null;
let twitchTokenExpiry = 0;

async function getTwitchAppToken() {
  const now = Math.floor(Date.now() / 1000);
  if (twitchToken && now < twitchTokenExpiry - 30) return twitchToken;

  const res = await _fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twitch token error: ${res.status} ${body}`);
  }
  const json = await res.json();
  twitchToken = json.access_token;
  twitchTokenExpiry = Math.floor(Date.now() / 1000) + (json.expires_in || 3600);
  return twitchToken;
}

async function getTwitchLiveInfo(login) {
  if (!login) return null;
  const token = await getTwitchAppToken();
  const res = await _fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Helix error: ${res.status} ${body}`);
  }
  const json = await res.json();
  if (!json.data || json.data.length === 0) return null;
  const s = json.data[0];
  return {
    title: s.title,
    started_at: s.started_at,
  };
}

// ---- offline fallback statuses ----
const OFFLINE_STATUSES = [
  { name: 'Chilling out', type: ActivityType.Listening },
  { name: 'Playing some games', type: ActivityType.Playing },
  { name: 'Working on the bot', type: ActivityType.Playing },
];

async function updateStatus(bot) {
  try {
    const login = process.env.TWITCH_USERNAME;
    const url = process.env.TWITCH_URL || (login ? `https://twitch.tv/${login}` : undefined);

    const live = login ? await getTwitchLiveInfo(login) : null;

    if (live && url) {
      // Live → show Streaming
      bot.user.setPresence({
        activities: [{ name: live.title || 'Streaming', type: ActivityType.Streaming, url }],
        status: 'online',
      });
    } else {
      // Offline → fallback rotation
      const pick = OFFLINE_STATUSES[Math.floor(Math.random() * OFFLINE_STATUSES.length)];
      bot.user.setPresence({ activities: [pick], status: 'online' });
    }
  } catch (e) {
    console.error('updateStatus error:', e.message || e);
    const pick = OFFLINE_STATUSES[Math.floor(Math.random() * OFFLINE_STATUSES.length)];
    bot.user.setPresence({ activities: [pick], status: 'online' });
  }
}

module.exports = { updateStatus };
