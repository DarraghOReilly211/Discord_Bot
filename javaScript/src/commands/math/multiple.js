const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('multiply')
        .setDescription('Multiplies two numbers')
        .addNumberOption(option =>
            option.setName('num1')
                .setDescription('The first number')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('num2')
                .setDescription('The second number')
                .setRequired(true)),

    async execute(interaction) {
        const num1 = interaction.options.getNumber('num1');
        const num2 = interaction.options.getNumber('num2');
        const product = num1 * num2;
        await interaction.reply(`The product of ${num1} and ${num2} is ${product}.`);
    },
};
