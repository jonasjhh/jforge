import type { Unit } from "./types";

// Blessing (Paladin): a helpful `bless` status. While it lasts the unit
// deals more damage and takes less, of every kind. Built into the damage
// functions, not a general second effect.

/** What a blessed unit deals with every hit, times. */
export const BLESS_DEALT = 1.2;
/** What a blessed unit takes from every hit, times. */
export const BLESS_TAKEN = 0.8;

function isBlessed(unit: Unit): boolean {
  return unit.statuses.some((s) => s.effect === "bless");
}

/** The unit's damage-dealt factor: BLESS_DEALT while blessed. */
export function blessDealt(unit: Unit): number {
  return isBlessed(unit) ? BLESS_DEALT : 1;
}

/** The unit's damage-taken factor: BLESS_TAKEN while blessed. */
export function blessTaken(unit: Unit): number {
  return isBlessed(unit) ? BLESS_TAKEN : 1;
}
