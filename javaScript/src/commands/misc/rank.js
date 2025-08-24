// javaScript/src/commands/misc/rank.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ✅ Correct path from /commands/misc/* to /src/db.js
const { getUserLevel } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank') // ensure this name is unique across your project
    .setDescription('Show your (or another member’s) level and XP.')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Member to check (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
      const member = interaction.options.getUser('user') ?? interaction.user;
      const guildId = interaction.guildId;

      const { level, xp } = getUserLevel(member.id, guildId); // { level, xp }

      const embed = new EmbedBuilder()
        .setAuthor({ name: `${member.username}`, iconURL: member.displayAvatarURL() })
        .setTitle('📈 Rank')
        .addFields(
          { name: 'Level', value: String(level), inline: true },
          { name: 'XP', value: String(xp), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('rank error:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('Sorry, something went wrong fetching the rank.');
      } else {
        await interaction.reply({ content: 'Sorry, something went wrong.', ephemeral: true });
      }
    }
  },
};
