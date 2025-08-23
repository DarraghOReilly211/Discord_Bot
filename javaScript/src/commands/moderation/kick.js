const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    )
    // Only members with Kick Members can use it
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Permission checks
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: 'I do not have permission to kick members.', ephemeral: true });
    }

    // Ensure the target is in the guild
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    }

    // Basic protections
    if (targetMember.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
    }
    if (targetMember.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot kick the server owner.', ephemeral: true });
    }

    // Bot capability check
    if (!targetMember.kickable) {
      return interaction.reply({
        content: 'I cannot kick this user. Their highest role may be above mine, or I lack permission.',
        ephemeral: true,
      });
    }

    // Invoker vs target role hierarchy (recommended)
    const invoker = interaction.member; // GuildMember
    if (
      invoker.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0 &&
      interaction.user.id !== interaction.guild.ownerId
    ) {
      return interaction.reply({
        content: 'You can only kick members with a lower role than yours.',
        ephemeral: true,
      });
    }

    // Try to DM the user (ignore failures)
    await targetUser.send(`You have been kicked from **${interaction.guild.name}**. Reason: ${reason}`).catch(() => {});

    // Execute the kick
    try {
      await targetMember.kick(reason);
      return interaction.reply({
        content: `Kicked ${targetUser.tag}. Reason: ${reason}`,
      });
    } catch (err) {
      console.error('Kick error:', err);
      return interaction.reply({
        content: 'Failed to kick that user. Check my permissions and role position.',
        ephemeral: true,
      });
    }
  },
};
