// src/utils/level.js
const { addXp, getUserLevel, getLeaderboard } = require('../db');

// Example XP curve helper
function xpForLevel(level) {
  // tweak to taste
  return 100 + (level - 1) * 25;
}

/**
 * Award message XP; call this from your messageCreate handler.
 * @param {import('discord.js').Message} message
 * @param {number} amount
 * @returns {{ level:number, xp:number, leveledUp:boolean, levelsGained:number }}
 */

function awardMessageXp(message, amount = 10) {
  if (!message.guild || !message.author || message.author.bot) {
    return { level: 0, xp: 0, leveledUp: false, levelsGained: 0 };
  }
  const userId = message.author.id;
  const guildId = message.guild.id;
  return addXp(userId, guildId, amount, xpForLevel);
}

module.exports = {
  xpForLevel,
  awardMessageXp,
  getUserLevel,
  getLeaderboard,
};
