import type { Library } from "@jforge/rules/core";
import { catalogue, select } from "../catalogue";
import { MELEE_SET } from "../picks";

// @jforge/content/jrpg: what jrpg uses of the catalogue. A class is
// rebalanced for jrpg alone by replacing it here with a changed copy
// (`{ ...it, baseStats: { ... } }`), leaving the catalogue as it is.

/** The archetypes jrpg uses. */
export const JRPG_ARCHETYPES: string[] = MELEE_SET;

/** jrpg's content: its archetypes and their characters. */
export function jrpgLibrary(): Library {
  return select(catalogue(), JRPG_ARCHETYPES);
}
