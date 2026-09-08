export const XP_PER_LEVEL = 500;

/** Weighted by difficulty (1-5), per the earlier schema decision. */
export function xpForTask(difficulty: number): number {
  return 10 * difficulty;
}

export function levelForXp(xpTotal: number) {
  const level = Math.floor(xpTotal / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xpTotal % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForLevel: XP_PER_LEVEL };
}
