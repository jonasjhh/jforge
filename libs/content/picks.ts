import * as content from "./catalogue/starter";
import { MELEE_CREATURES, meleeClassId, meleeCreatureId } from "./catalogue";

/**
 * The archetypes jrpg and autob both use for now: every melee class, its
 * summoned creatures and the goblin. The class graph's skill-less classes
 * are in no game yet.
 */
export const MELEE_SET: string[] = [
  ...content.playerTypes.map((def) => meleeClassId(def.id)),
  ...MELEE_CREATURES.map((def) => meleeCreatureId(def.id)),
  "enemy-goblin",
];
