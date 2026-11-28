import { Portrait } from "@jforge/look";
import type { UnitDef } from "../shared/types";

/** A unit as a hex or a bench slot shows it: portrait and name. */
export function UnitBadge({ def }: { def: UnitDef }) {
  return (
    <>
      <Portrait defId={def.portrait ?? def.id} />
      <span className="unit-name">{def.name}</span>
    </>
  );
}
