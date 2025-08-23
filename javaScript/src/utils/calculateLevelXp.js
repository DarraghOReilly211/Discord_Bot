module.exports = function xpForLevel(level) {
  const lvl = Math.max(1, Number(level) || 1);
  return 100 * lvl;
};
