import { archer, fighter, healer, mage, slime, wolf } from "../content";
import type {
  BattleSetup,
  CombatantDef,
  Placement,
  Side,
  Stats,
  Weapon,
} from "@jforge/battle/engine/types.ts";

/** A fixed battle of real content: four party types against a small pack. */
export const sampleBattle: BattleSetup = {
  placements: [
    { def: fighter, side: "player", position: { col: 1, row: 0 } },
    { def: archer, side: "player", position: { col: 3, row: 1 } },
    { def: mage, side: "player", position: { col: 1, row: 2 } },
    { def: healer, side: "player", position: { col: 3, row: 2 } },
    { def: slime, side: "enemy", position: { col: 1, row: 0 } },
    { def: slime, side: "enemy", position: { col: 3, row: 0 } },
    { def: wolf, side: "enemy", position: { col: 2, row: 1 } },
  ],
};

/** Reaches every enemy, so tests about other rules ignore reach. */
export const anywhere: Weapon = {
  id: "anywhere",
  name: "Anywhere",
  columns: "any",
  depth: "any",
  damageType: "slash",
  kind: "ranged",
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
