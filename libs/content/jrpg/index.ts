import type { Library } from "@jforge/rules/core";
import { WORLD_ENEMY_IDS, catalogue, select } from "../catalogue";
import { MELEE_SET } from "../picks";

// @jforge/content/jrpg: what jrpg uses of the catalogue. A class is
// rebalanced for jrpg alone by replacing it here with a changed copy
// (`{ ...it, baseStats: { ... } }`), leaving the catalogue as it is.

/** The archetypes jrpg uses: melee's set and the world's enemies. */
export const JRPG_ARCHETYPES: string[] = [...MELEE_SET, ...WORLD_ENEMY_IDS];

/** Names for travellers of classes without a hero, and when the list runs out. */
export const TRAVELLER_NAMES = [
  "Ansel",
  "Bryn",
  "Corin",
  "Dara",
  "Edda",
  "Finn",
  "Greta",
  "Ilse",
  "Joss",
  "Kell",
  "Lior",
  "Maren",
  "Nico",
  "Oona",
  "Perrin",
  "Quill",
];

/** jrpg's content: its archetypes and their characters. */
export function jrpgLibrary(): Library {
  return select(catalogue(), JRPG_ARCHETYPES);
}
