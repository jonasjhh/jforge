import { Portrait } from "@jforge/melee/battle";
import type { CombatantDef } from "@jforge/melee/shared";

/** A unit as a hex or a bench slot shows it: portrait and name. */
export function UnitBadge({ def }: { def: CombatantDef }) {
  return (
    <>
      <Portrait defId={def.portrait ?? def.id} />
      <span className="unit-name">{def.name}</span>
    </>
  );
}
