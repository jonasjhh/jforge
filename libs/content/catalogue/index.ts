import type { Library } from "@jforge/rules/core";
import { designs } from "./designs";
import { withMeleeClasses } from "./melee";
import { withWorldContent } from "./world";

// @jforge/content/catalogue: every class, enemy type, skill, piece of gear
// and character there is. A game takes what it uses of it (see select.ts
// and each game's folder); char's codex shows all of it.

/**
 * All the content: the catalogue's own designs, melee's classes, and the
 * world's enemies and gear.
 */
export function catalogue(): Library {
  return withWorldContent(withMeleeClasses(designs()));
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
export {
  WORLD_ENEMIES,
  WORLD_ENEMY_IDS,
  WORLD_GEAR,
  WORLD_SKILLS,
  withWorldContent,
} from "./world";
export { select } from "../select";
