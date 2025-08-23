// src/commands/calander/link-calendar.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link-calendar')
    .setDescription('Link your calendar account (Google or Microsoft)')
    .addStringOption(o =>
      o.setName('provider')
        .setDescription('Which calendar provider to link')
        .addChoices(
          { name: 'Google', value: 'google' },
          { name: 'Microsoft', value: 'microsoft' },
        )
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('visibility')
        .setDescription('Default visibility for this linked calendar')
        .addChoices(
          { name: 'private', value: 'private' },
          { name: 'public',  value: 'public'  },
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const provider = interaction.options.getString('provider', true);
    const visibility = interaction.options.getString('visibility', true);

    // Your auth server base (defaults to http://localhost:3000)
    const base = process.env.AUTH_BASE || `http://localhost:${process.env.AUTH_PORT || 3000}`;

    // Decide which start route to use
    const startPath = provider === 'microsoft' ? '/microsoft/start' : '/google/start';

    const url = new URL(base + startPath);
    url.searchParams.set('discord_user_id', interaction.user.id);
    url.searchParams.set('visibility', visibility);

    return interaction.editReply(
      `Click to link your ${provider} calendar (${visibility}): ${url.toString()}`
    );
  },
};
