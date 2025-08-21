const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('divide')
    .setDescription('Divide two numbers')
    .addSubcommand(sc =>
      sc.setName('float')
        .setDescription('Floating point division')
        .addNumberOption(o => o.setName('num1').setDescription('First number').setRequired(true))
        .addNumberOption(o => o.setName('num2').setDescription('Second number').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('int')
        .setDescription('Integer division (floored)')
        .addIntegerOption(o => o.setName('num1').setDescription('First integer').setRequired(true))
        .addIntegerOption(o => o.setName('num2').setDescription('Second integer').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'float') {
      const a = interaction.options.getNumber('num1');
      const b = interaction.options.getNumber('num2');
      if (b === 0) return interaction.reply({ content: 'Cannot divide by zero.', ephemeral: true });
      const result = a / b;
      return interaction.reply(`${a} ÷ ${b} = ${result}`);
    }

    if (sub === 'int') {
      const a = interaction.options.getInteger('num1');
      const b = interaction.options.getInteger('num2');
      if (b === 0) return interaction.reply({ content: 'Cannot divide by zero.', ephemeral: true });
      const result = Math.floor(a / b);
      return interaction.reply(`${a} ÷ ${b} = ${result} (floored)`);
    }
  },
};
