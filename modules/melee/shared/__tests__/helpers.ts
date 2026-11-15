import type { CombatantDef, Placement, Side, Stats, Weapon } from "../types";

/** Reaches every enemy, so tests about other rules ignore reach. */
export const anywhere: Weapon = {
  id: "anywhere",
  name: "Anywhere",
  columns: "any",
  depth: "any",
  damageType: "slash",
};

export function def(
  id: string,
  stats: Partial<Stats> = {},
  weapon: Weapon = anywhere,
): CombatantDef {
  return {
    id,
    name: id,
    weapon,
    stats: {
      maxHp: 100,
      maxMp: 0,
      attack: 10,
      magic: 0,
      defense: 0,
      spirit: 0,
      speed: 10,
      ...stats,
    },
  };
}

export function place(
  d: CombatantDef,
  side: Side,
  col: number,
  row = 0,
  extra: Partial<Placement> = {},
): Placement {
  return { def: d, side, position: { col, row }, ...extra };
}
