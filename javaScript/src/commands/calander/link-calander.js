// src/commands/calander/link-calendar.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

function makeState(userId) {
  // Simple state payload; ideally your auth server validates it
  const payload = {
    u: userId,
    t: Date.now(),
    n: Math.random().toString(36).slice(2, 10),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link-calendar')
    .setDescription('Link your calendar account (Google or Microsoft)')
    .addStringOption(o =>
      o
        .setName('provider')
        .setDescription('Which calendar provider to link')
        .addChoices(
          { name: 'Google', value: 'google' },
          { name: 'Microsoft', value: 'microsoft' },
        )
        .setRequired(true),
    )
    .addStringOption(o =>
      o
        .setName('visibility')
        .setDescription('Default visibility for this linked calendar')
        .addChoices(
          { name: 'private', value: 'private' },
          { name: 'public', value: 'public' },
        )
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const provider = interaction.options.getString('provider', true);
      const visibility = interaction.options.getString('visibility', true);

      // Resolve base URL from env
      const base =
        process.env.AUTH_BASE ||
        (process.env.AUTH_PORT ? `http://localhost:${process.env.AUTH_PORT}` : 'http://localhost:3000');

      if (!base) {
        return interaction.editReply(
          '⚠️ Auth server base URL not configured. Please set `AUTH_BASE` or `AUTH_PORT` in your `.env` file.',
        );
      }

      // Pick route
      const startPath = provider === 'microsoft' ? '/microsoft/start' : '/google/start';

      // Build URL safely
      const url = new URL(startPath, base);
      url.searchParams.set('discord_user_id', interaction.user.id);
      url.searchParams.set('visibility', visibility);
      if (interaction.guildId) url.searchParams.set('guild_id', interaction.guildId);
      if (interaction.channelId) url.searchParams.set('channel_id', interaction.channelId);
      url.searchParams.set('state', makeState(interaction.user.id));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(`Link ${provider.charAt(0).toUpperCase() + provider.slice(1)} calendar`)
          .setStyle(ButtonStyle.Link)
          .setURL(url.toString()),
      );

      return interaction.editReply({
        content: `Click the button below to link your **${provider}** calendar with **${visibility}** visibility.`,
        components: [row],
      });
    } catch (err) {
      console.error('link-calendar error:', err);
      return interaction.editReply(
        '❌ Failed to generate the authentication link. Please check that your `.env` has a valid `AUTH_BASE`/`AUTH_PORT` and that the auth server is running.',
      );
    }
  },
};
