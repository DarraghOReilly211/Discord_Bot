// src/handlers/rsvpButtons.js
const { setRsvp, getRsvpSummary } = require('../db');

module.exports = function attachRsvpHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isButton()) return;
      // customId format: rsvp|provider|calendarId|eventId|guildId|status
      if (!interaction.customId.startsWith('rsvp|')) return;

      const parts = interaction.customId.split('|');
      // rsvp|0:provider|1:cal|2:event|3:guild|4:status (older build)
      // or rsvp|provider|cal|event|guild|status (this build)
      let provider, calendarId, eventId, guildId, status;
      if (parts.length === 6) {
        [, provider, calendarId, eventId, guildId, status] = parts;
      } else if (parts.length === 5) {
        [, provider, calendarId, eventId, status] = parts;
        guildId = interaction.guildId || null;
      } else {
        return interaction.reply({ content: 'Invalid RSVP payload.', ephemeral: true });
      }

      setRsvp({
        guild_id: guildId || interaction.guildId || null,
        event_provider: provider,
        calendar_id: decodeURIComponent(calendarId),
        event_id: decodeURIComponent(eventId),
        discord_user_id: interaction.user.id,
        status: status === 'yes' ? 'yes' : 'no',
      });

      const counts = getRsvpSummary(provider, decodeURIComponent(calendarId), decodeURIComponent(eventId), interaction.guildId || null);
      await interaction.reply({ content: `RSVP recorded: **${status}**. Current: 👍 ${counts.yes} • 👎 ${counts.no}`, ephemeral: true });
    } catch (e) {
      console.error('rsvp button error:', e);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Failed to record RSVP.', ephemeral: true });
      }
    }
  });
};
