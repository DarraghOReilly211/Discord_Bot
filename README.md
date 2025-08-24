# Discord Bot with Calendar, Moderation, Levels, and Twitch Integration

A multi-purpose Discord bot available in **JavaScript (Node.js, discord.js v14)** and **Python (discord.py / nextcord) In Developement**.  
It combines moderation tools, role management, leveling, Twitch presence, and **Google/Microsoft Calendar integration**.

---

## Features

### Moderation
- `/ban`, `/unban`, `/kick`, `/mute` with proper permissions
- Banned words filter (configurable list)
- Role claiming via emoji reactions

### Leveling
- XP and levels per user per guild
- XP gained from sending messages
- `/rank` to view your level
- `/leaderboard` for server-wide ranking
- Uses SQLite (`better-sqlite3` in JS; `sqlite3` or `aiosqlite` planned for Python)

### Calendar Integration
Supports Google Calendar and Microsoft Outlook Calendar:
- `/link-calendar provider:<google|microsoft>` — Link your account
- `/set-calendar` — Choose your active calendar (per user default)
- `/list-calendars` — Show linked calendars
- `/my-events [count]` — View upcoming events
- `/create-event` — Create new events (with optional recurrence)
- `/delete-event` — Remove events
- View public calendars of others

### Reminders
- Daily and weekly reminders via DM or channel ping
- Event reminders (for example, “Starts in 10 minutes”)

### Twitch Integration
- Auto-updates bot status when you are streaming
- Fallback rotating statuses when offline

### Welcome
- Greets new members via DM and in a welcome channel

---

# Setup Instructions

## JavaScript Version

### 1. Clone the repository
  ```sh
  git clone <repo-url>
  cd javaScript
  ```


### 2. Install dependencies
    npm install

### 3. Create a .env file
    # Discord
    TOKEN=your_discord_bot_token
    CLIENT_ID=your_discord_app_client_id
    GUILD_ID=your_discord_server_id
    CHANNEL_ID=your_role_channel_id
    WELCOME_CHANNEL_ID=your_welcome_channel_id

    # Auth server
    AUTH_PORT=3000
    AUTH_BASE=http://localhost:3000

    # Google
    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    GOOGLE_REDIRECT=http://localhost:3000/google/callback

    # Microsoft
    MS_CLIENT_ID=...
    MS_CLIENT_SECRET=...
    MS_TENANT_ID=common
    MS_REDIRECT=http://localhost:3000/microsoft/callback

    # Twitch
    TWITCH_CLIENT_ID=...
    TWITCH_CLIENT_SECRET=...
    TWITCH_USERNAME=your_twitch_login_name


### 4. Run the bot
  ```nodemon src/index.js ```


## Python Version (placeholder)
### 1. Clone the repository
  ```
  git clone <repo-url>
  cd python
  ```

### 2. Create and activate a virtual environment
  ```python -m venv venv```
  # Linux/macOS
  ```source venv/bin/activate```
  # Windows
  ```venv\Scripts\activate```

### 3. Install dependencies
  ```pip install -r requirements.txt ```

### 4. Create a .env file
    #Discord
    DISCORD_TOKEN=your_discord_bot_token
    CLIENT_ID=your_discord_app_client_id
    GUILD_ID=your_discord_server_id
    CHANNEL_ID=your_role_channel_id
    WELCOME_CHANNEL_ID=your_welcome_channel_id

    # Google
    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    GOOGLE_REDIRECT=http://localhost:3000/google/callback

    # Microsoft
    MS_CLIENT_ID=...
    MS_CLIENT_SECRET=...
    MS_TENANT_ID=common
    MS_REDIRECT=http://localhost:3000/microsoft/callback

    # Twitch
    TWITCH_CLIENT_ID=...
    TWITCH_CLIENT_SECRET=...
    TWITCH_USERNAME=your_twitch_login_name

### 5. Run the bot
    python src/main.py


## Project Structure
  ``` 
  javaScript/
    src/
      commands/       # Slash commands (moderation, calendar, etc.)
      events/         # Event handlers (ready, welcome, message, etc.)
      utils/          # Helpers (status, role claims, file loader)
      config/         # Config files (banned words, settings)
      db.js           # SQLite connection and helpers
      authServer.js   # Express OAuth server for Google/Microsoft
    index.js          # Entry point (or src/index.js in your setup)

  python/             # Placeholder for the Python implementation
    src/
      commands/       # Slash commands (to be implemented)
      events/         # Event handlers (to be implemented)
      utils/          # Helpers (to be implemented)
      config/         # Config files (to be implemented)
      db.py           # SQLite helpers (to be implemented)
      auth_server.py  # FastAPI/Flask OAuth server (to be implemented)
    requirements.txt  # Dependencies (to be added)
    main.py           # Entry point (to be added)

  ```


## Commands (overview)

  ```
  Moderation: /ban, /unban, /kick, /mute

  Leveling: /rank, /leaderboard

  Calendar:

  /link-calendar provider:<google|microsoft> visibility:<private|public>

  /set-calendar provider:<google|microsoft> calendar_id:<id>

  /list-calendars

  /my-events [count]

  /create-event title:<text> start:<ISO> end:<ISO> [repeat:<none|daily|weekly>]

  /delete-event id:<event_id>

  Utility/Server:

  Reaction role message (pinned, with reactions)

  Welcome messages on member join
  ```

## Notes

  ```
  /set-calendar lets you pick which of your linked calendars (Google or Microsoft) the bot should use by default, so you do not have to choose every time.

  Ensure Google and Microsoft app registrations include redirect URIs that match your .env values exactly.

  The bot uses SQLite for persistence (bot.db). The schema includes tables for calendars and leveling.
  ```
