import {
  GEAR_CATEGORY_NAMES,
  canUse,
  type Archetype,
  type Character,
  type Gear,
  type Library,
} from "@jforge/rules/core";
import { Links } from "./Links";
import { STAT_LABELS } from "./labels";
import { WeaponLine } from "./WeaponLine";

interface GearViewProps {
  gear: Gear;
  library: Library;
  onOpenArchetype: (archetype: Archetype) => void;
  onOpenCharacter: (character: Character) => void;
}

const bonus = (b: Gear["bonuses"][number]) =>
  `${STAT_LABELS[b.stat]} ${b.op === "mul" ? `×${b.value}` : b.value < 0 ? b.value : `+${b.value}`}`;

/** A piece of gear: its slot, bonuses, and who can and does wear it. */
export function GearView({
  gear,
  library,
  onOpenArchetype,
  onOpenCharacter,
}: GearViewProps) {
  const users = library.archetypes.filter(
    (a) => a.kind === "class" && canUse(a, gear),
  );
  const wearers = library.characters.filter((c) =>
    Object.values(c.gear).includes(gear.id),
  );
  return (
    <>
      <h2>{gear.name}</h2>
      <p className="muted">
        {gear.slot}
        {gear.category ? ` · ${GEAR_CATEGORY_NAMES[gear.category]}` : ""}
      </p>
      <p>
        <strong>Gives:</strong>{" "}
        {gear.bonuses.length > 0
          ? gear.bonuses.map(bonus).join(", ")
          : "nothing"}
      </p>
      {gear.weapon && <WeaponLine weapon={gear.weapon} />}
      <fieldset className="group">
        <legend>Usable by</legend>
        <Links
          label="Usable by"
          items={users}
          none="No class here."
          onOpen={onOpenArchetype}
        />
      </fieldset>
      <fieldset className="group">
        <legend>Worn by</legend>
        <Links
          label="Worn by"
          items={wearers}
          none="No one here."
          onOpen={onOpenCharacter}
        />
      </fieldset>
    </>
  );
}
