const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard')
    .addIntegerOption(o =>
      o.setName('count').setDescription('How many top users (default 10)').setMinValue(1).setMaxValue(20)
    ),

  async execute(interaction) {
    const count = interaction.options.getInteger('count') || 10;
    const rows = getLeaderboard(interaction.guild.id, count);

    if (!rows.length) return interaction.reply('No leaderboard data yet.');

    const desc = rows
      .map((row, i) => 
        `#${i + 1} <@${row.discord_user_id}> — Level **${row.level}** (${row.xp} XP)`
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.guild.name} Leaderboard`)
      .setDescription(desc)
      .setColor('Gold');

    await interaction.reply({ embeds: [embed] });
  },
};
