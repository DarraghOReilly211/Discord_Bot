const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .addStringOption(option =>
      option
        .setName('user_id')
        .setDescription('The ID of the user to unban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the unban')
        .setRequired(false)
    )
    // Only members with Ban Members can use it
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Basic permission checks
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'You do not have permission to unban members.', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'I do not have permission to unban members.', ephemeral: true });
    }

    // Quick sanity check for a Discord snowflake-looking ID
    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: 'Please provide a valid Discord user ID.', ephemeral: true });
    }

    try {
      // Verify the user is actually banned
      const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!ban) {
        return interaction.reply({ content: 'That user is not currently banned.', ephemeral: true });
      }

      // Attempt to unban
      await interaction.guild.bans.remove(userId, reason);

      // Try to show a nice tag if we have it
      const tag = ban.user?.tag || userId;

      return interaction.reply({ content: `Unbanned ${tag}. Reason: ${reason}` });
    } catch (err) {
      console.error('Unban error:', err);
      return interaction.reply({
        content: 'Failed to unban that user. I may lack permission, or the ID is invalid.',
        ephemeral: true,
      });
    }
  },
};
