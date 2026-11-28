import type { Unit } from "./types";

export function isTaunting(unit: Unit): boolean {
  return unit.statuses.some((s) => s.effect === "taunt");
}

/**
 * The units among `candidates` an attacker may single out: the taunting
 * ones while any of them is a candidate, else all of them.
 */
export function forcedTargets(candidates: Unit[]): Unit[] {
  const taunting = candidates.filter(isTaunting);
  return taunting.length > 0 ? taunting : candidates;
}

/**
 * Why `target` can't be singled out from `candidates` (the units the
 * attacker could pick), or null if it can.
 */
export function tauntBlock(candidates: Unit[], target: Unit): string | null {
  if (isTaunting(target)) return null;
  const taunter = candidates.find(isTaunting);
  return taunter ? `${taunter.name} is provoking: target it instead` : null;
}
