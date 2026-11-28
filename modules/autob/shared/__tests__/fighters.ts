import type { CombatantDef } from "@jforge/melee/shared";
import type { Skill, Weapon } from "@jforge/rules/core";
import type { Hex } from "../hex";
import type { FightEntry } from "../fight";

const sword: Weapon = {
  id: "sword",
  name: "Sword",
  columns: 1,
  depth: 1,
  damageType: "slash",
  kind: "melee",
};

/** A plain fighter: 100 HP, 10 attack and magic, no defense, speed 10. */
export function unit(overrides: Partial<CombatantDef> = {}): CombatantDef {
  return {
    id: "u",
    name: "Unit",
    stats: {
      maxHp: 100,
      maxMp: 0,
      attack: 10,
      magic: 10,
      defense: 0,
      spirit: 0,
      speed: 10,
    },
    weapon: sword,
    ...overrides,
  };
}

export const bow: Weapon = {
  ...sword,
  id: "bow",
  name: "Bow",
  kind: "ranged",
  damageType: "pierce",
};

/** A skill with no MP cost, on one target. */
export function skill(
  effect: Skill["effect"],
  overrides: Partial<Skill> = {},
): Skill {
  return {
    id: "s",
    name: "Skill",
    description: "",
    mpCost: 0,
    target: "enemy",
    area: "single",
    effect,
    ...overrides,
  };
}

export const at = (
  def: CombatantDef,
  side: "player" | "enemy",
  hex: Hex,
): FightEntry => ({
  def,
  side,
  hex,
});
