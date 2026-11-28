import type { Library } from "@jforge/rules/core";
import { designs } from "./designs";
import { withMeleeClasses } from "./melee";

// @jforge/content/catalogue: every class, enemy type, skill, piece of gear
// and character there is. A game takes what it uses of it (see select.ts
// and each game's folder); char's codex shows all of it.

/** All the content: the catalogue's own designs and melee's classes. */
export function catalogue(): Library {
  return withMeleeClasses(designs());
}

export {
  BASIC_ARMOR,
  MELEE_CREATURES,
  MELEE_HEROES,
  basicGear,
  basicWeapon,
  classFromMelee,
  creatureFromMelee,
  meleeClassId,
  meleeClasses,
  meleeCreatureId,
  meleeHeroId,
  meleeWeaponId,
  starterKit,
  withCreatureSource,
  withMeleeClasses,
} from "./melee";
export { select } from "../select";
