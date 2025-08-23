# Discord Multipurpose Bot

A feature-rich Discord bot built with **Discord.js v14**, designed to handle moderation, leveling, calendars, reaction roles, Twitch status updates, and more.  
The bot uses **SQLite (better-sqlite3)** for persistent storage and supports **Google Calendar integration** to asllow organisation accross teams and projects, I amde this to assist in team projects with my college group projects.
This allowed us to easily see who was assigned to each task and see when their work deadline was.

---

## ✨ Features

### 👮 Moderation
- `/ban` — Ban a user with optional reason.
- `/unban` — Unban a previously banned user.
- `/kick` — Kick a user from the server.
- `/mute` — Timeout a user for hours/minutes/seconds.
- **Banned words filter** — Deletes messages containing blacklisted words.
- **Permission checks** — Only users with the right permissions can run moderation commands.

### 🎉 Engagement
- **Welcome messages** — Greets new members with a DM and public channel announcement.
- **Leveling system**  
  - Gain XP by chatting.  
  - Level up automatically with DB persistence.  
  - `/level` — View your current level and XP.  
  - `/leaderboard` — View the top members in your guild.

### 📅 Calendar Integration
- **Google Calendar OAuth** (via local auth server).  
- `/link-calendar` — Link your Google account.  
- `/my-events` — Show your upcoming events.  
- `/create-event` — Add an event to your calendar.  
- `/delete-event` — Remove an event from your calendar.  
- *(Planned)*: `/set-calendar`, `/list-calendars`, view others’ public calendars, reminders.

### 🎭 Utility
- **Reaction roles** — Claim roles via pinned embed.
- **Slash commands auto-registration** — Registers per-guild commands on startup.
- **Dynamic status** — Rotates between idle statuses and shows Twitch live status if streaming.

---

## 🗂 Project Structure

