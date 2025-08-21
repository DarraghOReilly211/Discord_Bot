const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

let colornames = null;
try { colornames = require('colornames'); } catch {  }

const NAMED_COLORS = {
  red: '#FF0000',
  yellow: '#FFFF00',
  blue: '#0000FF',
  green: '#00FF00',
  purple: '#800080',
  orange: '#FFA500',
  black: '#000000',
  white: '#FFFFFF',
  gray: '#808080',
  grey: '#808080',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  pink: '#FFC0CB',
  teal: '#008080',
  lime: '#00FF00',
  navy: '#000080',
  maroon: '#800000',
  olive: '#808000',
  silver: '#C0C0C0',
  gold: '#FFD700',
  brown: '#A52A2A',
};

function normalizeColor(input) {
  if (!input) return undefined;
  const raw = String(input).trim();

  if (colornames) {
    const hex = colornames(raw);
    if (hex) return hex.toUpperCase();
  }

  const byName = NAMED_COLORS[raw.toLowerCase()];
  if (byName) return byName;

  const cleaned = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9A-F]{3}$/i.test(cleaned)) {
    const [r, g, b] = cleaned.toUpperCase().split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9A-F]{6}$/i.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Creates an embedded message')
    .addStringOption(o =>
      o.setName('title').setDescription('The title of the embed').setRequired(true))
    .addStringOption(o =>
      o.setName('description').setDescription('The description of the embed').setRequired(true))
    .addStringOption(o =>
      o.setName('color')
        .setDescription('Hex (#5865F2, fff) or name (red, blue, gold, etc.)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const colorInput = interaction.options.getString('color');

      const normalized = normalizeColor(colorInput);
      if (normalized === null) {
        return interaction.editReply(
          'Invalid color. Use hex like `#5865F2`, `5865F2`, `#fff`, `fff`, or a name like `red`, `yellow`, `blue`, `gold`.'
        );
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description);

      if (normalized) embed.setColor(normalized);

      await interaction.editReply({ content: '', embeds: [embed] });
    } catch (err) {
      console.error('Embed command error:', err);
      const msg = 'Failed to send embed. Check bot permissions (Send Messages & Embed Links).';
      if (interaction.deferred || interaction.replied) {
        try { await interaction.editReply(msg); } catch {}
      } else {
        try { await interaction.reply({ content: msg }); } catch {}
      }
    }
  },
};
