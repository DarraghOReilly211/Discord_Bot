require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Client, IntentsBitField, Partials } = require('discord.js');
const { registerEvents } = require('./src/handlers/eventHandler.js');
const { startReminderWorker } = require('./src/events/reminders.js');
const { startDigestWorker } = require('./src/config/digest.js');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

registerEvents(client);
client.login(process.env.TOKEN);
