const { Events } = require('discord.js');
const { addXp } = require('../db');
const xpForLevel = require('../utils/calculateLevelXp');

const cooldowns = new Map();

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();

    if (cooldowns.has(key) && now - cooldowns.get(key) < 60 * 1000) return;
    cooldowns.set(key, now);

    const xpGained = Math.floor(Math.random() * 10) + 5; // 5–15 XP
    const { level, leveledUp, levelsGained } = addXp(
      message.author.id,
      message.guild.id,
      xpGained,
      xpForLevel
    );

    if (leveledUp) {
      message.channel.send(
        `🎉 <@${message.author.id}> leveled up to **${level}**! (+${levelsGained} level${levelsGained > 1 ? 's' : ''})`
      );
    }
  },
};
