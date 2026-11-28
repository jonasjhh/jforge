import {
  GEAR_CATEGORY_NAMES,
  archetypeSkills,
  effectSummary,
  type Archetype,
  type Character,
  type Library,
} from "@jforge/rules/core";
import { ClassPaths } from "./ClassPaths";
import { Links } from "./Links";
import { ROW_NAMES } from "./labels";
import { StatsTable } from "./StatsTable";
import { WeaponLine } from "./WeaponLine";

interface ArchetypeViewProps {
  archetype: Archetype;
  library: Library;
  onOpenSkill: (id: string) => void;
  onOpenClass: (id: string) => void;
  onOpenCharacter: (character: Character) => void;
}

/** A class or enemy type: its stats, weapon, traits, skills and paths. */
export function ArchetypeView({
  archetype,
  library,
  onOpenSkill,
  onOpenClass,
  onOpenCharacter,
}: ArchetypeViewProps) {
  const isClass = archetype.kind === "class";
  const characters = library.characters.filter(
    (c) => c.archetypeId === archetype.id,
  );
  const traits = archetype.traits.join(", ");
  const uses = archetype.proficiencies?.map((p) => GEAR_CATEGORY_NAMES[p]);
  return (
    <>
      <h2>{archetype.name}</h2>
      <p className="muted">
        {isClass ? "Class" : "Enemy type"} · prefers the{" "}
        {ROW_NAMES[archetype.preferredRow]?.toLowerCase() ?? "front"} row
        {archetype.obstacle ? " · an obstacle: never acts" : ""}
        {traits ? ` · ${traits}` : ""}
      </p>
      <StatsTable stats={archetype.baseStats} />
      <WeaponLine weapon={archetype.weapon} />
      {isClass && (
        <p>
          Uses{" "}
          {uses === undefined
            ? "any gear"
            : uses.length === 0
              ? "only gear anyone can use"
              : uses.join(", ")}
          .
        </p>
      )}
      <fieldset className="group">
        <legend>Skills</legend>
        <Links
          label="Skills"
          items={archetypeSkills(library, archetype)}
          none="None."
          note={effectSummary}
          onOpen={(s) => onOpenSkill(s.id)}
        />
      </fieldset>
      {isClass && (
        <ClassPaths
          archetype={archetype}
          library={library}
          onOpen={onOpenClass}
        />
      )}
      <fieldset className="group">
        <legend>Characters</legend>
        <Links
          label="Characters"
          items={characters}
          none="None."
          onOpen={onOpenCharacter}
        />
      </fieldset>
    </>
  );
}
