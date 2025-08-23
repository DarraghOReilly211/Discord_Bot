const { Events } = require('discord.js');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      await member.send(
        `Welcome to **${member.guild.name}**, ${member.user.username}!`
      );

      // Send message to welcome channel
      const channelId = process.env.WELCOME_CHANNEL_ID; // add this to your .env
      const channel = member.guild.channels.cache.get(channelId);

      if (channel) {
        await channel.send(
          `Everyone welcome <@${member.id}> to the server!`
        );
      }
    } catch (err) {
      console.error('Error sending welcome message:', err);
    }
  },
};
