import {
  archetypeOf,
  characterStats,
  characterWeapon,
  equippedGear,
  type Archetype,
  type Character,
  type Library,
} from "@jforge/rules/core";
import { Links } from "./Links";
import { StatsTable } from "./StatsTable";
import { WeaponLine } from "./WeaponLine";

interface CharacterViewProps {
  character: Character;
  library: Library;
  onOpenArchetype: (archetype: Archetype) => void;
  onOpenGear: (id: string) => void;
}

/** A character: its archetype, its gear and the stats they give it. */
export function CharacterView({
  character,
  library,
  onOpenArchetype,
  onOpenGear,
}: CharacterViewProps) {
  const archetype = archetypeOf(library, character);
  const stats = characterStats(library, character);
  if (!archetype || !stats) {
    return (
      <>
        <h2>{character.name}</h2>
        <p className="bad">Its archetype, {character.archetypeId}, is gone.</p>
      </>
    );
  }
  return (
    <>
      <h2>{character.name}</h2>
      <p className="muted">
        A{archetype.kind === "enemy" ? "n enemy " : " "}
        <button
          type="button"
          className="link-button"
          aria-label={`Open ${archetype.name}`}
          onClick={() => onOpenArchetype(archetype)}
        >
          {archetype.name}
        </button>
      </p>
      <StatsTable stats={stats.base} total={stats.total} />
      <WeaponLine weapon={characterWeapon(library, archetype, character)} />
      <fieldset className="group">
        <legend>Gear</legend>
        <Links
          label="Gear"
          items={equippedGear(library, character)}
          none="None."
          note={(g) => g.slot}
          onOpen={(g) => onOpenGear(g.id)}
        />
      </fieldset>
    </>
  );
}
