import { STAT_NAMES, type Stats } from "./format";
import {
  GEAR_SLOTS,
  type Archetype,
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

/** Whether characters of `type` can use `gear`. */
export function canUse(type: Archetype | undefined, gear: Gear): boolean {
  return (
    gear.category === undefined ||
    type?.proficiencies === undefined ||
    type.proficiencies.includes(gear.category)
  );
}

/** Whether `character` can use `gear`, by their class's proficiencies. */
export function canWear(
  library: Library,
  character: Character,
  gear: Gear,
): boolean {
  return canUse(
    library.archetypes.find((a) => a.id === character.archetypeId),
    gear,
  );
}

/** Puts `gear` in its slot, replacing what was there. */
export function equip<C extends Character>(character: C, gear: Gear): C {
  return { ...character, gear: { ...character.gear, [gear.slot]: gear.id } };
}

/** Empties a slot. */
export function unequip<C extends Character>(character: C, slot: GearSlot): C {
  const gear = { ...character.gear };
  delete gear[slot];
  return { ...character, gear };
}

/**
 * The gear a character wears, in slot order. A slot pointing at gear that
 * no longer exists, belongs in another slot or that their class cannot
 * use counts as empty.
 */
export function equippedGear(library: Library, character: Character): Gear[] {
  return GEAR_SLOTS.flatMap((slot) => {
    const worn = library.gear.find((g) => g.id === character.gear[slot]);
    return worn && worn.slot === slot && canWear(library, character, worn)
      ? [worn]
      : [];
  });
}
