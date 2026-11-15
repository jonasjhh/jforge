/** How fast battles play: gauges and action pauses run this many times faster. */
export type BattleSpeed = 1 | 2;

const KEY = "melee.battleSpeed";

/** The speed chosen on this device, or 1. Storage may be unavailable. */
export function loadBattleSpeed(): BattleSpeed {
  try {
    return localStorage.getItem(KEY) === "2" ? 2 : 1;
  } catch {
    return 1;
  }
}

export function saveBattleSpeed(speed: BattleSpeed): void {
  try {
    localStorage.setItem(KEY, String(speed));
  } catch {
    // Not remembered; it still applies to this battle.
  }
}
