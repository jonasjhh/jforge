import { STAT_NAMES, type Stats } from "@jforge/melee/shared";
import {
  GEAR_SLOTS,
  type Character,
  type Gear,
  type GearSlot,
  type Library,
  type StatBonus,
} from "./types";

/**
 * Stats with bonuses applied, the way melee applies modifiers: (base + the
 * sum of adds) x the product of multipliers, rounded. Never below 0, and
 * always at least 1 HP.
 */
export function applyBonuses(stats: Stats, bonuses: StatBonus[]): Stats {
  const result = {} as Stats;
  for (const stat of STAT_NAMES) {
    let add = 0;
    let mul = 1;
    for (const bonus of bonuses) {
      if (bonus.stat !== stat) continue;
      if (bonus.op === "add") add += bonus.value;
      else mul *= bonus.value;
    }
    const value = Math.max(0, Math.round((stats[stat] + add) * mul));
    result[stat] = stat === "maxHp" ? Math.max(1, value) : value;
  }
  return result;
}

/** Puts `gear` in its slot, replacing what was there. */
export function equip(character: Character, gear: Gear): Character {
  return { ...character, gear: { ...character.gear, [gear.slot]: gear.id } };
}

/** Empties a slot. */
export function unequip(character: Character, slot: GearSlot): Character {
  const gear = { ...character.gear };
  delete gear[slot];
  return { ...character, gear };
}

/**
 * The gear a character wears, in slot order. A slot pointing at gear that
 * no longer exists, or that belongs in another slot, counts as empty.
 */
export function equippedGear(library: Library, character: Character): Gear[] {
  return GEAR_SLOTS.flatMap((slot) => {
    const worn = library.gear.find((g) => g.id === character.gear[slot]);
    return worn && worn.slot === slot ? [worn] : [];
  });
}
