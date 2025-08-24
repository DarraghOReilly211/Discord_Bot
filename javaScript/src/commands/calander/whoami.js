// src/commands/calander/whoami.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLinkSummary } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whoami')
    .setDescription('Show your linked providers and active calendars'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { counts, active } = getLinkSummary(interaction.user.id);

      const countMap = Object.fromEntries(counts.map(r => [r.provider, r.n]));
      const activeMap = {};
      for (const a of active) activeMap[a.provider] = a;

      const lines = ['**Linked providers:**'];
      for (const p of ['google', 'microsoft']) {
        const n = countMap[p] || 0;
        const act = activeMap[p];
        if (n === 0) {
          lines.push(`• ${p}: not linked`);
        } else if (act) {
          lines.push(
            `• ${p}: ${n} calendar(s), active=\`${act.calendar_id}\` (${act.visibility})`
          );
        } else {
          lines.push(`• ${p}: ${n} calendar(s), **no active**`);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username} — account link info`)
        .setDescription(lines.join('\n'))
        .setTimestamp(new Date());

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error('whoami error:', e);
      return interaction.editReply('Failed to fetch your link info.');
    }
  },
};
