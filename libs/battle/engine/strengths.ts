import type { Strengths } from "@jforge/rules/core";
import type { Unit } from "./types";

/** The product of one strength over every status on the unit. */
export function strengthOn(unit: Unit, key: keyof Strengths): number {
  let factor = 1;
  for (const status of unit.statuses) factor *= status[key] ?? 1;
  return factor;
}
