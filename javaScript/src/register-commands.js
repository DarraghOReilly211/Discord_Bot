require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { REST, Routes, Options, Application, ApplicationCommand, ApplicationCommandOptionType} = require('discord.js');

const commands = [
    {
        name: 'add',
        description: 'Add two numbers',
        options: [
            {name: 'first-number', description: 'The first number', type: ApplicationCommandOptionType.Number, required: true},
            {name: 'second-number', description: 'The second number', type: ApplicationCommandOptionType.Number, required: true}
        ]
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // The put method is used to fully refresh all commands in the guild with the current set
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();