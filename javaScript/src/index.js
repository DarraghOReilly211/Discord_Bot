require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Client, IntentsBitField, Partials } = require('discord.js');
const { registerEvents } = require('./handlers/eventHandler.js');
const { startReminderWorker } = require('./events/reminders');
const { startDigestWorker } = require('./config/digest');

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
