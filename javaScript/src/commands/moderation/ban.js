const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    // Only members with Ban Members can use it
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    // Basic sanity checks
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'I do not have permission to ban members.', ephemeral: true });
    }
    if (!targetMember) {
      return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    }
    if (targetMember.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot ban yourself.', ephemeral: true });
    }
    if (targetMember.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot ban the server owner.', ephemeral: true });
    }
    if (!targetMember.bannable) {
      return interaction.reply({
        content: 'I cannot ban this user. Their role might be higher than mine or I lack permission.',
        ephemeral: true,
      });
    }

    const invoker = interaction.member;
    if (
      invoker.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0 &&
      interaction.user.id !== interaction.guild.ownerId
    ) {
      return interaction.reply({
        content: 'You can only ban members with a lower role than yours.',
        ephemeral: true,
      });
    }

    await targetUser.send(`You have been banned from **${interaction.guild.name}**. Reason: ${reason}`).catch(() => {});

    try {
      await targetMember.ban({ reason });
      return interaction.reply({
        content: `Banned **${targetUser.tag}**. Reason: ${reason}`,
      });
    } catch (err) {
      console.error('Ban error:', err);
      return interaction.reply({
        content: 'Failed to ban that user. Check my permissions and role position.',
        ephemeral: true,
      });
    }
  },
};
