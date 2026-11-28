import type { Creature, Skill, Stats, Weapon } from "./format";
import { applyBonuses, equippedGear } from "./gear";
import type { Archetype, Character, Library } from "./types";

// Turns content into creatures, what every game builds its units from.
// Gear is worked into plain stats here, so no game needs to know about it. The content knows
// no levels: a game that has them passes the stats a character has before
// gear.

export function archetypeOf(
  library: Library,
  character: Character,
): Archetype | undefined {
  return library.archetypes.find((a) => a.id === character.archetypeId);
}

/**
 * A character's stats before gear (`base`, its archetype's own unless
 * given) and with its gear on.
 */
export function characterStats(
  library: Library,
  character: Character,
  base?: Stats,
): { base: Stats; total: Stats } | null {
  const archetype = archetypeOf(library, character);
  if (!archetype) return null;
  const before = base ?? archetype.baseStats;
  const bonuses = equippedGear(library, character).flatMap((g) => g.bonuses);
  return { base: before, total: applyBonuses(before, bonuses) };
}

/**
 * How deep summons are compiled: a creature's own summons are compiled one
 * step less, and below that keep the creature they were saved with, so a
 * type that summons itself still compiles.
 */
export const SUMMON_DEPTH = 2;

/** The skills an archetype has, leaving out any no longer in the library. */
export function archetypeSkills(
  library: Library,
  archetype: Archetype,
  depth = SUMMON_DEPTH,
): Skill[] {
  return archetype.skills.flatMap((id) => {
    const skill = library.skills.find((s) => s.id === id);
    return skill ? [compileSkill(library, skill, depth)] : [];
  });
}

/**
 * The creature a summon is, as a skill puts it in: its own stats and
 * weapon, no gear. Null if the summon is gone.
 */
export function creatureOf(
  library: Library,
  archetypeId: string,
  depth = SUMMON_DEPTH,
): Creature | null {
  const archetype = library.archetypes.find((a) => a.id === archetypeId);
  if (!archetype) return null;
  return {
    id: archetype.id,
    name: archetype.name,
    stats: { ...archetype.baseStats },
    weapon: structuredClone(archetype.weapon),
    skills: archetypeSkills(library, archetype, depth - 1),
    traits: [...archetype.traits],
    ...(archetype.resistances
      ? { resistances: { ...archetype.resistances } }
      : {}),
    preferredRow: archetype.preferredRow,
    portrait: archetype.portrait,
    ...(archetype.obstacle ? { obstacle: true } : {}),
  };
}

/**
 * `skill` with its summon's creature made again from the summon it
 * names, so changes to the type reach the skill. Otherwise, or
 * when the type is gone, it is the skill as saved.
 */
export function compileSkill(
  library: Library,
  skill: Skill,
  depth = SUMMON_DEPTH,
): Skill {
  const { effect } = skill;
  if (effect.type !== "summon" || !effect.source || depth <= 0) return skill;
  const creature = creatureOf(library, effect.source.archetypeId, depth);
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

/**
 * The creature a character is, from `base` stats before gear (its
 * archetype's own unless given); null if its archetype is gone. How it
 * picks targets and how dangerous it counts are each game's to add.
 */
export function toCreature(
  library: Library,
  character: Character,
  base?: Stats,
): Creature | null {
  const archetype = archetypeOf(library, character);
  const stats = characterStats(library, character, base);
  if (!archetype || !stats) return null;
  return {
    id: `char-${character.id}`,
    name: character.name,
    stats: stats.total,
    weapon: characterWeapon(library, archetype, character),
    skills: archetypeSkills(library, archetype),
    traits: [...archetype.traits],
    ...(archetype.resistances
      ? { resistances: { ...archetype.resistances } }
      : {}),
    preferredRow: archetype.preferredRow,
    portrait: archetype.portrait,
  };
}

/** A library's characters as creatures: the party and the monster pool. */
export interface Roster {
  party: Creature[];
  monsters: Creature[];
}

/**
 * A library as one roster: characters of a class form the party,
 * characters of an enemy type the monster pool. Summons are neither: a
 * skill puts them in.
 */
export function compileRoster(library: Library): Roster {
  const roster: Roster = { party: [], monsters: [] };
  for (const character of library.characters) {
    const archetype = archetypeOf(library, character);
    const def = toCreature(library, character);
    if (!archetype || !def || archetype.kind === "summon") continue;
    (archetype.kind === "class" ? roster.party : roster.monsters).push(def);
  }
  return roster;
}
