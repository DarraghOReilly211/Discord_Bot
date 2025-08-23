const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord hard limit: 28 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily time out a member (mute) for a duration.')
    .addUserOption(o =>
      o.setName('target')
        .setDescription('The user to time out')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('hours')
        .setDescription('Hours (0–672)')
        .setMinValue(0)
        .setMaxValue(672) // 28 days in hours
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('minutes')
        .setDescription('Minutes (0–59)')
        .setMinValue(0)
        .setMaxValue(59)
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('seconds')
        .setDescription('Seconds (0–59)')
        .setMinValue(0)
        .setMaxValue(59)
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)
    )
    // Only members with Timeout (Moderate Members) can use it
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('target', true);
    const hours = interaction.options.getInteger('hours') ?? 0;
    const minutes = interaction.options.getInteger('minutes') ?? 0;
    const seconds = interaction.options.getInteger('seconds') ?? 0;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Permission checks
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: 'You do not have permission to time out members.', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: 'I do not have permission to time out members.', ephemeral: true });
    }

    // Ensure target is in guild
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    }

    // Basic protections
    if (targetMember.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot time out yourself.', ephemeral: true });
    }
    if (targetMember.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot time out the server owner.', ephemeral: true });
    }

    // Bot capability / hierarchy checks
    if (!targetMember.moderatable) {
      return interaction.reply({
        content: 'I cannot time out this user. Their highest role may be above mine, or I lack permission.',
        ephemeral: true,
      });
    }
    const invoker = interaction.member;
    if (
      invoker.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0 &&
      interaction.user.id !== interaction.guild.ownerId
    ) {
      return interaction.reply({
        content: 'You can only time out members with a lower role than yours.',
        ephemeral: true,
      });
    }

    // Compute duration
    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

    // If totalMs == 0, clear the timeout (untimeout)
    if (totalMs === 0) {
      try {
        await targetMember.timeout(null, `Timeout cleared by ${interaction.user.tag}: ${reason}`);
        return interaction.reply({ content: `Removed timeout for ${targetUser.tag}.` });
      } catch (err) {
        console.error('Clear timeout error:', err);
        return interaction.reply({
          content: 'Failed to remove timeout for that user. Check my permissions and role position.',
          ephemeral: true,
        });
      }
    }

    if (totalMs < 0) {
      return interaction.reply({ content: 'Duration must be positive.', ephemeral: true });
    }
    if (totalMs > MAX_TIMEOUT_MS) {
      return interaction.reply({
        content: 'Duration exceeds the maximum of 28 days.',
        ephemeral: true,
      });
    }

    // Try to DM the user (non-fatal)
    await targetUser.send(
      `You have been timed out in **${interaction.guild.name}** for ${formatDuration(totalMs)}. Reason: ${reason}`
    ).catch(() => {});

    // Apply the timeout
    try {
      await targetMember.timeout(totalMs, reason);
      return interaction.reply({
        content: `Timed out ${targetUser.tag} for ${formatDuration(totalMs)}. Reason: ${reason}`,
      });
    } catch (err) {
      console.error('Timeout error:', err);
      return interaction.reply({
        content: 'Failed to time out that user. Check my permissions and role position.',
        ephemeral: true,
      });
    }
  },
};

// Helper to show a human-friendly duration
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(' ');
}
