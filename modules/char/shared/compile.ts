import {
  estimateThreat,
  type CombatantDef,
  type Roster,
  type Skill,
  type Stats,
  type Weapon,
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

/**
 * How deep summons are compiled: a creature's own summons are compiled one
 * level less, and below that keep the creature they were saved with, so a
 * type that summons itself still compiles.
 */
export const SUMMON_DEPTH = 2;

/** The skills an archetype knows at a level, in the order it learns them. */
export function unlockedSkills(
  library: Library,
  archetype: Archetype,
  level: number,
  depth = SUMMON_DEPTH,
): Skill[] {
  const at = clampLevel(level);
  return [...archetype.skills]
    .filter((unlock) => unlock.level <= at)
    .sort((a, b) => a.level - b.level)
    .flatMap((unlock) => {
      const skill = library.skills.find((s) => s.id === unlock.skillId);
      return skill ? [compileSkill(library, skill, depth)] : [];
    });
}

/**
 * The creature an enemy type is at a level, as a summon puts it in: no
 * gear, its own weapon. Null if the type is gone.
 */
export function creatureOf(
  library: Library,
  archetypeId: string,
  level: number,
  depth = SUMMON_DEPTH,
): CombatantDef | null {
  const archetype = library.archetypes.find((a) => a.id === archetypeId);
  if (!archetype) return null;
  return {
    id: archetype.id,
    name: archetype.name,
    stats: statsAtLevel(archetype.baseStats, archetype.growth, level),
    weapon: structuredClone(archetype.weapon),
    skills: unlockedSkills(library, archetype, level, depth - 1),
    traits: [...archetype.traits],
    preferredRow: archetype.preferredRow,
    portrait: archetype.portrait,
    ...(archetype.obstacle ? { obstacle: true } : {}),
  };
}

/**
 * `skill` with its summon's creature made again from the enemy type and
 * level it names, so changes to the type reach the skill. Otherwise, or
 * when the type is gone, it is the skill as saved.
 */
export function compileSkill(
  library: Library,
  skill: Skill,
  depth = SUMMON_DEPTH,
): Skill {
  const { effect } = skill;
  if (effect.type !== "summon" || !effect.source || depth <= 0) return skill;
  const creature = creatureOf(
    library,
    effect.source.archetypeId,
    effect.source.level,
    depth,
  );
  return creature ? { ...skill, effect: { ...effect, creature } } : skill;
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
  const def: CombatantDef = {
    id: `char-${character.id}`,
    name: character.name,
    stats: stats.total,
    weapon: characterWeapon(library, archetype, character),
    skills: unlockedSkills(library, archetype, character.level),
    traits: [...archetype.traits],
    preferredRow: archetype.preferredRow,
    portrait: archetype.portrait,
  };
  // Enemies take a share of the encounter budget that grows with their
  // stats, so a higher level or better gear means fewer of them.
  return archetype.kind === "enemy"
    ? { ...def, threat: estimateThreat(def) }
    : def;
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
