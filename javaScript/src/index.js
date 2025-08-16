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
    if (commandName === 'ping') {
        await interaction.reply('Pong!');
    } else if (commandName === 'hello') {
        await interaction.reply('Hello!');
    } else  if (commandName === 'beep') {
        await interaction.reply('Boop!');
    } else {
        await interaction.reply(`Unknown command: ${commandName}`);
    }
});

// Log in to Discord
client.login(process.env.TOKEN);
