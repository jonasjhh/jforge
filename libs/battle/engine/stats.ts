import type { StatName, Unit } from "./types";

/** (base + sum of adds) x product of muls, never below 0. */
export function effectiveStat(unit: Unit, stat: StatName): number {
  let add = 0;
  let mul = 1;
  for (const m of unit.modifiers) {
    if (m.stat !== stat) continue;
    if (m.op === "add") add += m.value;
    else mul *= m.value;
  }
  // Statuses' defence strengths (Stone Skin).
  if (stat === "defence") {
    for (const s of unit.statuses) mul *= s.defence ?? 1;
  }
  return Math.max(0, (unit.base[stat] + add) * mul);
}

export function isAlive(unit: Unit): boolean {
  return unit.hp > 0;
}
