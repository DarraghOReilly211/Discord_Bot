// twitch-status.js
const { ActivityType, EmbedBuilder } = require('discord.js');

// Use global fetch if available (Node 18+); otherwise fall back to node-fetch
const ensureFetch = () => {
  if (typeof fetch === 'function') return fetch;
  return (...args) => import('node-fetch').then(m => m.default(...args));
};
const _fetch = ensureFetch();

const GRAPH_PREVIEW = (login) =>
  `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(login)}-1920x1080.jpg`;

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
  const res = await _fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
    {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    }
  );
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

// ---- live announcement state ----
let wasLive = false;
let lastStreamStart = null; // ISO string of started_at we last announced
let lastAnnounceAt = 0;     // ms since epoch
const ANNOUNCE_COOLDOWN_MS =
  Math.max(0, Number(process.env.LIVE_ANNOUNCE_COOLDOWN_MIN || 30)) * 60 * 1000;

async function updateStatus(bot) {
  try {
    const login = process.env.TWITCH_USERNAME;
    const url = process.env.TWITCH_URL || (login ? `https://twitch.tv/${login}` : undefined);

    const live = login ? await getTwitchLiveInfo(login) : null;

    if (live && url) {
      // Presence: Streaming
      bot.user.setPresence({
        activities: [{ name: `${login} playing ${live.title}` || 'Streaming', type: ActivityType.Streaming, url }],
        status: 'online',
      });

      // Determine if we should announce (went live or new session)
      const now = Date.now();
      const startedChanged = live.started_at && live.started_at !== lastStreamStart;
      const cooldownOk = now - lastAnnounceAt >= ANNOUNCE_COOLDOWN_MS;

      if ((!wasLive || startedChanged) && cooldownOk) {
        const channelId = process.env.ANNOUNCE_CHANNEL;
        if (channelId) {
          try {
            const channel = await bot.channels.fetch(channelId);
            if (channel) {
              const startedUnix = Math.floor(new Date(live.started_at).getTime() / 1000);
              const embed = new EmbedBuilder()
                .setTitle(`${login} is now live on Twitch!`)
                .setURL(url)
                .setDescription(live.title || 'Streaming now!')
                .setColor(0x9146ff)
                .addFields({ name: 'Started', value: `<t:${startedUnix}:R>` })
                .setThumbnail(GRAPH_PREVIEW(login))
                .setFooter({ text: 'Click the title to watch live' });

              channel.send("@everyone " + `${login} is now live on Twitch!`);
              await channel.send({ embeds: [embed] });
              lastAnnounceAt = now;
              lastStreamStart = live.started_at || null;
              
            }
          } catch (e) {
            console.error('announce embed error:', e?.message || e);
          }
        }
      }

      wasLive = true;
    } else {
      // Offline → fallback rotation
      const pick = OFFLINE_STATUSES[Math.floor(Math.random() * OFFLINE_STATUSES.length)];
      bot.user.setPresence({ activities: [pick], status: 'online' });
      wasLive = false;
    }
  } catch (e) {
    console.error('updateStatus error:', e.message || e);
    const pick = OFFLINE_STATUSES[Math.floor(Math.random() * OFFLINE_STATUSES.length)];
    bot.user.setPresence({ activities: [pick], status: 'online' });
  }
}

module.exports = { updateStatus };
