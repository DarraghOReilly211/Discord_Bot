const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Creates an embedded message')
    .addStringOption(o =>
      o.setName('title').setDescription('The title of the embed').setRequired(true))
    .addStringOption(o =>
      o.setName('description').setDescription('The description of the embed').setRequired(true))
    .addStringOption(o =>
      o.setName('color').setDescription('Hex color like #5865F2').setRequired(false)),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const colorInput = interaction.options.getString('color');

    // Validate/normalize color (optional)
    let color = undefined;
    if (colorInput) {
      if (/^#?[0-9A-F]{6}$/i.test(colorInput)) {
        color = colorInput.startsWith('#') ? colorInput : `#${colorInput}`;
      } else {
        return interaction.reply({
          content: 'Invalid color. Use a hex value like `#5865F2` or `5865F2`.',
          ephemeral: true,
        });
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description);

    if (color) embed.setColor(color);

    await interaction.reply({ embeds: [embed] });
  },
};
