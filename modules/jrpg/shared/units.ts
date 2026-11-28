import { estimateThreat, type CombatantDef } from "@jforge/battle";
import { jrpgLibrary } from "@jforge/content/jrpg";
import { creatureOf } from "@jforge/rules/core";

// jrpg's own versions of the catalogue's designs, for fights outside a
// run (the opening battle): compiled from jrpg's content, an enemy with
// the threat the battle estimates for it, as in a run (growth.ts).

const library = jrpgLibrary();

/** jrpg's unit of the archetype `archetypeId`, at level 1. */
export function jrpgUnit(archetypeId: string): CombatantDef {
  const design = creatureOf(library, archetypeId);
  if (!design) throw new Error(`jrpg has no archetype ${archetypeId}`);
  const archetype = library.archetypes.find((a) => a.id === archetypeId)!;
  return archetype.kind === "enemy"
    ? { ...design, threat: estimateThreat(design) }
    : design;
}
