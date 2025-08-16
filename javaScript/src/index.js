require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Client, IntentsBitField} = require('discord.js');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

// When the bot is ready
client.once('ready', (c) => {
    console.log(`✅ Logged in as ${c.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Handle commands here
    if (commandName === 'add') {
        const num1 = interaction.options.getNumber('first-number');
        const num2 = interaction.options.getNumber('second-number');
        const sum = num1 + num2;
        await interaction.reply(`The sum is: ${sum}`);
    } else {
        await interaction.reply(`Unknown command: ${commandName}`);
    }
});

// Log in to Discord
client.login(process.env.TOKEN);
