import type {
  CombatantDef,
  Roster,
  Skill,
  Stats,
  Weapon,
} from "@jforge/melee/shared";
import { applyBonuses, equippedGear } from "./gear";
import { clampLevel, statsAtLevel } from "./progression";
import type { Archetype, Character, Library } from "./types";

// Turns designs into what melee fights with. Levels and gear are worked
// into plain stats here, so melee needs to know nothing about either.

export function archetypeOf(
  library: Library,
  character: Character,
): Archetype | undefined {
  return library.archetypes.find((a) => a.id === character.archetypeId);
}

/** A character's stats from its level alone, and with its gear on. */
export function characterStats(
  library: Library,
  character: Character,
): { leveled: Stats; total: Stats } | null {
  const archetype = archetypeOf(library, character);
  if (!archetype) return null;
  const leveled = statsAtLevel(
    archetype.baseStats,
    archetype.growth,
    character.level,
  );
  const bonuses = equippedGear(library, character).flatMap((g) => g.bonuses);
  return { leveled, total: applyBonuses(leveled, bonuses) };
}

/** The skills an archetype knows at a level, in the order it learns them. */
export function unlockedSkills(
  library: Library,
  archetype: Archetype,
  level: number,
): Skill[] {
  const at = clampLevel(level);
  return [...archetype.skills]
    .filter((unlock) => unlock.level <= at)
    .sort((a, b) => a.level - b.level)
    .flatMap((unlock) => {
      const skill = library.skills.find((s) => s.id === unlock.skillId);
      return skill ? [skill] : [];
    });
}

/** The equipped weapon, or the archetype's own when the slot is empty. */
export function characterWeapon(
  library: Library,
  archetype: Archetype,
  character: Character,
): Weapon {
  const held = equippedGear(library, character).find(
    (g) => g.slot === "weapon",
  );
  return held?.weapon ?? archetype.weapon;
}

/** The melee combatant for a character; null if its archetype is gone. */
export function toCombatantDef(
  library: Library,
  character: Character,
): CombatantDef | null {
  const archetype = archetypeOf(library, character);
  const stats = characterStats(library, character);
  if (!archetype || !stats) return null;
  return {
    id: `char-${character.id}`,
    name: character.name,
    stats: stats.total,
    weapon: characterWeapon(library, archetype, character),
    skills: unlockedSkills(library, archetype, character.level),
    traits: [...archetype.traits],
    preferredRow: archetype.preferredRow,
    portrait: archetype.portrait,
    ...(archetype.kind === "enemy" ? { threat: archetype.threat } : {}),
  };
}

/**
 * Everything melee and jrpg import: characters of a class form the party,
 * characters of an enemy type the monster pool.
 */
export function compileRoster(library: Library): Roster {
  const roster: Roster = { party: [], monsters: [] };
  for (const character of library.characters) {
    const archetype = archetypeOf(library, character);
    const def = toCombatantDef(library, character);
    if (!archetype || !def) continue;
    (archetype.kind === "class" ? roster.party : roster.monsters).push(def);
  }
  return roster;
}
