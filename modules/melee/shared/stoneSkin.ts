import type { Unit } from "./types";

// Stone Skin (Geomancer): a helpful `stoneSkin` status. While it lasts the
// unit's defense is x1.5 and pushes and pulls don't move it: the strike
// still lands as a normal hit, never as a crash.

/** A stone-skinned unit's defense, times. */
export const STONE_SKIN_DEFENSE = 1.5;

/** Whether pushes and pulls leave `unit` where it stands. */
export function isRooted(unit: Unit): boolean {
  return unit.statuses.some((s) => s.effect === "stoneSkin");
}
