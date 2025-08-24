// javaScript/src/commands/misc/leaderBoard.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ✅ Correct path from /commands/misc/* to /src/db.js
const { getLeaderboard } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard') // ensure this name is unique across your project
    .setDescription('Show the top users by level/xp in this server.')
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('How many users to show (default 10, max 25)')
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
      const guildId = interaction.guildId;
      const limit = interaction.options.getInteger('limit') ?? 10;

      const rows = getLeaderboard(guildId, limit); // [{ discord_user_id, level, xp }, ...]

      if (!rows || rows.length === 0) {
        await interaction.editReply('No leaderboard data yet. Start chatting to earn XP!');
        return;
      }

      const lines = rows.map((r, i) => {
        const place = i + 1;
        const userTag = `<@${r.discord_user_id}>`;
        return `**${place}.** ${userTag} — Level **${r.level}**, XP **${r.xp}**`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Leaderboard — Top ${rows.length}`)
        .setDescription(lines.join('\n'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('leaderboard error:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('Sorry, something went wrong showing the leaderboard.');
      } else {
        await interaction.reply({ content: 'Sorry, something went wrong.', ephemeral: true });
      }
    }
  },
};
