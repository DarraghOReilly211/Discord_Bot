require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const {
  Client,
  IntentsBitField,
  Collection,
  REST,
  Routes,
  EmbedBuilder,
  PermissionsBitField,
  Partials,
  ActivityType
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const { emojiToRole, emojiLabels, ROLE_EMBED_TAG } = require('./utils/claimRole');

// ---------------------------------------------
// Client setup (note added reactions intent + partials)
// ---------------------------------------------
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction], // handle uncached reactions
});

client.commands = new Collection();
const commands = [];

// ---------------------------------------------
// Load commands from ./commands (unchanged)
// ---------------------------------------------
const commandsPath = path.join(__dirname, 'commands');

function loadCommands(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(filePath);
    } else if (file.name.endsWith('.js')) {
      const cmd = require(filePath);
      if (cmd?.data && cmd?.execute) {
        client.commands.set(cmd.data.name, cmd);
        if (typeof cmd.data.toJSON === 'function') commands.push(cmd.data.toJSON());
      }
    }
  }
}
loadCommands(commandsPath);

// ---------------------------------------------
// Helper: upsert a single pinned reaction-roles embed
// ---------------------------------------------
async function ensureReactionRoleMessage(channel) {
  // find existing pinned message from this bot with our tag
  const pinned = await channel.messages.fetchPinned().catch(() => null);
  let target = pinned?.find(
    (m) => m.author?.id === client.user.id && m.embeds?.[0]?.footer?.text === ROLE_EMBED_TAG
  );

  // build embed description lines from mapping
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

  // Ensure required reactions are present (add missing ones)
  for (const emojiKey of Object.keys(emojiToRole)) {
    const has = target.reactions.cache.find((r) =>
      r.emoji.id ? r.emoji.id === emojiKey : r.emoji.name === emojiKey
    );
    if (!has) {
      try {
        await target.react(emojiKey);
      } catch {
      }
    }
  }

  return target;
}

const status = require('./utils/getStatus');

// ---------------------------------------------
// Ready
// ---------------------------------------------
client.once('ready', async (c) => {
  setInterval(() => {
    const activity = status[Math.floor(Math.random() * status.length)];
    c.user.setActivity(activity);
  }, 10000);

  // Register slash commands (guild). Skip if none found to avoid wiping.
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    if (commands.length === 0) {
      console.warn('No commands found; skipping registration to avoid wiping.');
    } else {
      console.log('Refreshing slash commands...');
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log('Slash commands registered.');
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
  }

  // Upsert the reaction-roles message
  try {
    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
      console.warn('CHANNEL_ID not set; skipping reaction roles message.');
      return;
    }
    const channel = await c.channels.fetch(channelId);
    if (!channel) {
      console.warn('CHANNEL_ID is invalid or not accessible.');
      return;
    }
    await ensureReactionRoleMessage(channel);
  } catch (error) {
    console.log('Error sending reaction roles message:', error);
  }
});

// ---------------------------------------------
// Reaction handlers: grant/remove roles
// ---------------------------------------------
function resolveRoleIdFromReaction(reaction) {
  // For Unicode emoji: reaction.emoji.name is the escape string we used as the key.
  // For custom emoji: reaction.emoji.id is the key.
  return reaction.emoji.id ? emojiToRole[reaction.emoji.id] : emojiToRole[reaction.emoji.name];
}

async function handleRoleChange(reaction, user, action) {
  try {
    if (user.bot) return;

    // Fetch partials if needed
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const { message } = reaction;
    if (!message.guild) return;

    // Only act on our specific pinned embed
    const embed = message.embeds?.[0];
    if (!embed || embed.footer?.text !== ROLE_EMBED_TAG) return;

    const roleId = resolveRoleIdFromReaction(reaction);
    if (!roleId) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    const role = message.guild.roles.cache.get(roleId);
    if (!member || !role) return;

    // Permission and hierarchy checks
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

client.on('messageReactionAdd', (reaction, user) => handleRoleChange(reaction, user, 'add'));
client.on('messageReactionRemove', (reaction, user) => handleRoleChange(reaction, user, 'remove'));

// ---------------------------------------------
// Slash commands (unchanged)
// ---------------------------------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: 'Unknown command!' });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      try {
        await interaction.editReply('There was an error executing this command.');
      } catch {
        await interaction.followUp({ content: 'There was an error executing this command.' });
      }
    } else {
      await interaction.reply({ content: 'There was an error executing this command.' });
    }
  }
});

// ---------------------------------------------
// Login
// ---------------------------------------------
client.login(process.env.TOKEN);
