import type { BattleEvent, Unit } from "./types";

/** The ambush of a stealthed unit's first damaging action, times (1 if none). */
export function ambushPower(unit: Unit): number {
  const stealth = unit.statuses.find((s) => s.effect === "stealth");
  return stealth ? (stealth.ambush ?? 1) : 1;
}

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
  const power = ambushPower(unit);
  unit.statuses = unit.statuses.filter((s) => s.effect !== "stealth");
  events.push({ type: "ambush", unitId: unit.id });
  return power;
}
