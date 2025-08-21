const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link-calendar')
    .setDescription('Link your Google Calendar to the bot')
    .addStringOption(o =>
      o.setName('visibility')
       .setDescription('Who can view your events via the bot?')
       .addChoices({ name: 'private', value: 'private' }, { name: 'public', value: 'public' })
       .setRequired(true)
    ),

  async execute(interaction) {
    const visibility = interaction.options.getString('visibility');
    const url = `http://localhost:3000/google/start?discord_user_id=${interaction.user.id}&visibility=${visibility}`;
    await interaction.reply({
      content: `Click to link your Google Calendar (${visibility}): ${url}\nThen run \`/my-events\`.`,
      ephemeral: true
    });
  }
};
