// src/handlers/eventHandler.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const {
  REST,
  Routes,
  EmbedBuilder,
  PermissionsBitField,
  Collection,
} = require('discord.js');

const path = require('path');
const { getAllFiles } = require('../utils/getAllFiles.js');
const { emojiToRole, emojiLabels, ROLE_EMBED_TAG } = require('../utils/claimRole.js');
const { updateStatus } = require('../utils/getStatus.js');

// NOTE: adjust if you move the auth server file
const { startAuthServer } = require('../commands/calander/authServer.js');

// RSVP button handler (attach later, once we have a client)
const attachRsvpHandler = require('./rsvpButtons');

/* -----------------------------
   Reaction-roles helpers
----------------------------- */
async function ensureReactionRoleMessage(client, channel) {
  const pinned = await channel.messages.fetchPinned().catch(() => null);
  let target = pinned?.find(
    (m) => m.author?.id === client.user.id && m.embeds?.[0]?.footer?.text === ROLE_EMBED_TAG
  );

  const lines = Object.entries(emojiLabels).map(([emojiKey, label]) => {
    const roleId = emojiToRole[emojiKey];
    const role = channel.guild.roles.cache.get(roleId);
    const roleName = role ? role.name : `Unknown role (${roleId})`;
    return `• ${label} — ${roleName}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('Claim your roles')
    .setDescription(lines.join('\n'))
    .setFooter({ text: ROLE_EMBED_TAG });

  if (target) {
    await target.edit({ embeds: [embed] }).catch(() => {});
  } else {
    target = await channel.send({ embeds: [embed] });
    await target.pin().catch(() => {});
  }

  // add missing reactions
  for (const emojiKey of Object.keys(emojiToRole)) {
    const has = target.reactions.cache.find((r) =>
      r.emoji.id ? r.emoji.id === emojiKey : r.emoji.name === emojiKey
    );
    if (!has) {
      try { await target.react(emojiKey); } catch {}
    }
  }
  return target;
}

function resolveRoleIdFromReaction(reaction) {
  return reaction.emoji.id ? emojiToRole[reaction.emoji.id] : emojiToRole[reaction.emoji.name];
}

async function handleRoleChange(client, reaction, user, action) {
  try {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const { message } = reaction;
    if (!message.guild) return;

    const embed = message.embeds?.[0];
    if (!embed || embed.footer?.text !== ROLE_EMBED_TAG) return;

    const roleId = resolveRoleIdFromReaction(reaction);
    if (!roleId) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    const role = message.guild.roles.cache.get(roleId);
    if (!member || !role) return;

    const me = message.guild.members.me;
    if (!me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;
    if (me.roles.highest.comparePositionTo(role) <= 0) return;

    if (action === 'add') {
      if (!member.roles.cache.has(roleId)) await member.roles.add(role).catch(() => {});
    } else {
      if (member.roles.cache.has(roleId)) await member.roles.remove(role).catch(() => {});
    }
  } catch (e) {
    console.error('Reaction role error:', e);
  }
}

/* -----------------------------
   Loaders
----------------------------- */
function loadCommands(client) {
  client.commands = new Collection();
  const commandsJSON = [];

  const roots = [
    path.join(__dirname, '../commands'),
    path.join(__dirname, '../utils'),   // only modules exporting {data, execute} will be added
  ];
  const jsFilter = (p) => p.endsWith('.js') && !p.endsWith('index.js');

  for (const root of roots) {
    const files = getAllFiles(root, jsFilter);
    for (const file of files) {
      try {
        const mod = require(file);
        if (mod?.data && mod?.execute) {
          client.commands.set(mod.data.name, mod);
          if (typeof mod.data.toJSON === 'function') {
            commandsJSON.push(mod.data.toJSON());
          }
        }
      } catch (err) {
        console.error(`Failed to load command at ${file}:`, err.message);
      }
    }
  }

  return commandsJSON; // used for REST registration
}

function loadEvents(client) {
  const eventsRoot = path.join(__dirname, '../events');
  const files = getAllFiles(eventsRoot, (p) => p.endsWith('.js') && !p.endsWith('index.js'));

  for (const file of files) {
    try {
      const evt = require(file);
      // Expecting modules with shape: { name, execute, once? }
      if (!evt?.name || typeof evt.execute !== 'function') continue;

      if (evt.once) {
        client.once(evt.name, (...args) => evt.execute(...args, client));
      } else {
        client.on(evt.name, (...args) => evt.execute(...args, client));
      }
    } catch (err) {
      console.error(`Failed to load event at ${file}:`, err.message);
    }
  }
}

/* -----------------------------
   Main exported function
----------------------------- */
async function registerEvents(client) {
  // Attach RSVP handler once
  if (!client.__rsvpAttached) {
    attachRsvpHandler(client);
    client.__rsvpAttached = true;
  }

  // 1) Load slash commands and events
  const commandsJSON = loadCommands(client);
  loadEvents(client);

  // 2) Built-in runtime events
  client.once('ready', async (c) => {
    console.log(`Logged in as ${c.user.tag}!`);

    // Auth server
    try {
      const port = process.env.AUTH_PORT ? Number(process.env.AUTH_PORT) : 3000;
      startAuthServer(port);
    } catch (e) {
      console.error('Failed to start auth server:', e.message || e);
    }

    // Twitch presence (optional)
    const hasTwitch =
      process.env.TWITCH_CLIENT_ID &&
      process.env.TWITCH_CLIENT_SECRET &&
      process.env.TWITCH_USERNAME;

    if (hasTwitch) {
      try { await updateStatus(c); } catch (e) { console.error('updateStatus (initial):', e); }
      setInterval(() => { updateStatus(c).catch(() => {}); }, 60_000);
    } else {
      console.log('Skipping Twitch presence (missing TWITCH_* env vars).');
    }

    // Register slash commands (guild-scoped)
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
      if (commandsJSON.length === 0) {
        console.warn('No commands found; skipping registration to avoid wiping.');
      } else {
        console.log('Refreshing slash commands...');
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
          { body: commandsJSON }
        );
        console.log('Slash commands registered.');
      }
    } catch (error) {
      console.error('Failed to register commands:', error);
    }

    // Reaction role embed
    try {
      const channelId = process.env.CHANNEL_ID;
      if (!channelId) {
        console.warn('CHANNEL_ID not set; skipping reaction roles message.');
      } else {
        const channel = await c.channels.fetch(channelId);
        if (!channel) {
          console.warn('CHANNEL_ID is invalid or not accessible.');
        } else {
          await ensureReactionRoleMessage(client, channel);
        }
      }
    } catch (error) {
      console.log('Error sending reaction roles message:', error);
    }
  });

  // Slash command dispatcher
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return interaction.reply({ content: 'Unknown command!' });

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.deferred || interaction.replied) {
        try { await interaction.editReply('There was an error executing this command.'); }
        catch { await interaction.followUp({ content: 'There was an error executing this command.' }); }
      } else {
        await interaction.reply({ content: 'There was an error executing this command.' });
      }
    }
  });

  // Reaction roles (these stay here unless you also move them to /events)
  client.on('messageReactionAdd', (reaction, user) =>
    handleRoleChange(client, reaction, user, 'add')
  );
  client.on('messageReactionRemove', (reaction, user) =>
    handleRoleChange(client, reaction, user, 'remove')
  );
}

module.exports = { registerEvents };
