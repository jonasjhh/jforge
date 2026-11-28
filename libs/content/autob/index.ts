import type { Library } from "@jforge/rules/core";
import { catalogue, select } from "../catalogue";
import { MELEE_SET } from "../picks";

// @jforge/content/autob: what autob uses of the catalogue. A class is
// rebalanced for autob alone by replacing it here with a changed copy
// (`{ ...it, baseStats: { ... } }`), leaving the catalogue as it is.

/** The archetypes autob uses: what its shop can sell. */
export const AUTOB_ARCHETYPES: string[] = MELEE_SET;

/** autob's content: its archetypes and their characters. */
export function autobLibrary(): Library {
  return select(catalogue(), AUTOB_ARCHETYPES);
}
