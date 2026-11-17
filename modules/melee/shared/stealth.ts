import type { BattleEvent, Unit } from "./types";

/** Damage multiplier for the first damaging action out of stealth. */
export const AMBUSH_POWER = 2;

export function isStealthed(unit: Unit): boolean {
  return unit.statuses.some((s) => s.effect === "stealth");
}

/**
 * Enemies can't single it out (weapon attacks, single-target skills):
 * stealthed, or hidden in smoke (Smoke Bomb).
 */
export function isHidden(unit: Unit): boolean {
  return unit.statuses.some(
    (s) => s.effect === "stealth" || s.effect === "smoke",
  );
}

/**
 * Called when `unit` starts a damaging action: if it was stealthed, stealth
 * ends and the action is an ambush. Returns the damage multiplier.
 */
export function breakStealth(unit: Unit, events: BattleEvent[]): number {
  if (!isStealthed(unit)) return 1;
  unit.statuses = unit.statuses.filter((s) => s.effect !== "stealth");
  events.push({ type: "ambush", unitId: unit.id });
  return AMBUSH_POWER;
}
