import {
  GEAR_CATEGORY_NAMES,
  archetypeSkills,
  effectSummary,
  type Archetype,
  type Character,
  type Library,
  type Resistances,
} from "@jforge/rules/core";
import { ClassPaths } from "./ClassPaths";
import { Links } from "./Links";
import { KINDS, ROW_NAMES } from "./labels";
import { StatsTable } from "./StatsTable";
import { WeaponLine } from "./WeaponLine";

/** Its own resistances in words: "immune to poison", "takes 2× fire". */
function resistanceText(resistances: Resistances | undefined): string {
  return Object.entries(resistances ?? {})
    .map(([type, taken]) =>
      taken === 0 ? `immune to ${type}` : `takes ${taken}× ${type}`,
    )
    .join(", ");
}

interface ArchetypeViewProps {
  archetype: Archetype;
  library: Library;
  onOpenSkill: (id: string) => void;
  onOpenClass: (id: string) => void;
  onOpenCharacter: (character: Character) => void;
}

/**
 * A class, enemy type or summon: its stats, weapon, traits, skills, and
 * its paths (a class) or what summons it (a summon).
 */
export function ArchetypeView({
  archetype,
  library,
  onOpenSkill,
  onOpenClass,
  onOpenCharacter,
}: ArchetypeViewProps) {
  const isClass = archetype.kind === "class";
  const isSummon = archetype.kind === "summon";
  const summonedBy = library.skills.filter(
    (s) =>
      s.effect.type === "summon" &&
      s.effect.source?.archetypeId === archetype.id,
  );
  const characters = library.characters.filter(
    (c) => c.archetypeId === archetype.id,
  );
  const traits = archetype.traits.join(", ");
  const resists = resistanceText(archetype.resistances);
  const uses = archetype.proficiencies?.map((p) => GEAR_CATEGORY_NAMES[p]);
  return (
    <>
      <h2>{archetype.name}</h2>
      <p className="muted">
        {KINDS[archetype.kind].label} · prefers the{" "}
        {ROW_NAMES[archetype.preferredRow]?.toLowerCase() ?? "front"} row
        {archetype.obstacle ? " · an obstacle: never acts" : ""}
        {traits ? ` · ${traits}` : ""}
        {resists ? ` · ${resists}` : ""}
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
      {isSummon ? (
        <fieldset className="group">
          <legend>Summoned by</legend>
          <Links
            label="Summoned by"
            items={summonedBy}
            none="No skill here."
            note={effectSummary}
            onOpen={(s) => onOpenSkill(s.id)}
          />
        </fieldset>
      ) : (
        <fieldset className="group">
          <legend>Characters</legend>
          <Links
            label="Characters"
            items={characters}
            none="None."
            onOpen={onOpenCharacter}
          />
        </fieldset>
      )}
    </>
  );
}
