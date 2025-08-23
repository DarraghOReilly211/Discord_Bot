const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserLevel } = require('../../db');
const xpForLevel = require('../../utils/calculateLevelXp');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your current level and XP'),
  
  async execute(interaction) {
    const { level, xp } = getUserLevel(interaction.user.id, interaction.guild.id);
    const needed = xpForLevel(level);
    const percent = Math.floor((xp / needed) * 100);

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Rank`)
      .setDescription(`Level **${level}**\nXP: ${xp}/${needed} (${percent}%)`)
      .setColor('Blue');

    await interaction.reply({ embeds: [embed] });
  },
};
