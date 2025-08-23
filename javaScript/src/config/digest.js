const { SlashCommandBuilder } = require('discord.js');
const { upsertDigestSetting } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('digest')
    .setDescription('Configure daily/weekly digests (DM)')
    .addStringOption(o =>
      o.setName('frequency')
       .setDescription('daily or weekly')
       .addChoices(
         { name: 'daily', value: 'daily' },
         { name: 'weekly', value: 'weekly' },
       )
       .setRequired(true)
    )
    .addIntegerOption(o => o.setName('hour').setDescription('Hour (0–23)').setMinValue(0).setMaxValue(23).setRequired(true))
    .addIntegerOption(o => o.setName('minute').setDescription('Minute (0–59)').setMinValue(0).setMaxValue(59).setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const frequency = interaction.options.getString('frequency', true);
    const hour = interaction.options.getInteger('hour', true);
    const minute = interaction.options.getInteger('minute', true);

    upsertDigestSetting({ discord_user_id: interaction.user.id, frequency, hour, minute });
    return interaction.editReply(`Digest saved: ${frequency} at ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}.`);
  },
};
