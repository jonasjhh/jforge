import {
  STAT_NAMES,
  content,
  type CombatantDef,
  type Stats,
} from "@jforge/melee/shared";
import type { Archetype, Library } from "./types";

// Melee's own classes as char classes, so every one of them can be
// levelled, geared, edited and sent to jrpg like a designed class.

/** The level at which a melee class has exactly melee's stats. */
export const MELEE_CLASS_LEVEL = 3;
/** Growth per level, as a share of the stats at level 1. */
export const MELEE_GROWTH = 0.08;
/** Speed grows slower: it decides how often a unit acts. */
export const MELEE_SPEED_GROWTH = 0.02;
/** The level each skill is learned at, in melee's order. */
export const MELEE_SKILL_LEVELS = [1, 2, 4, 6, 8, 10];

export const meleeClassId = (id: string) => `melee-${id}`;

/** A melee type as a class: its stats at MELEE_CLASS_LEVEL, growing from 1. */
export function classFromMelee(def: CombatantDef): Archetype {
  const baseStats = {} as Stats;
  const growth = {} as Stats;
  const steps = MELEE_CLASS_LEVEL - 1;
  for (const stat of STAT_NAMES) {
    const rate = stat === "speed" ? MELEE_SPEED_GROWTH : MELEE_GROWTH;
    const base = def.stats[stat] / (1 + rate * steps);
    baseStats[stat] = Math.round(base * 10) / 10;
    growth[stat] = Math.round(base * rate * 100) / 100;
  }
  return {
    id: meleeClassId(def.id),
    name: def.name,
    kind: "class",
    portrait: def.id,
    baseStats,
    growth,
    weapon: structuredClone(def.weapon),
    skills: (def.skills ?? []).map((skill, i) => ({
      skillId: skill.id,
      level: MELEE_SKILL_LEVELS[i] ?? MELEE_SKILL_LEVELS.at(-1)! + 2 * i,
    })),
    traits: [...(def.traits ?? [])],
    preferredRow: def.preferredRow ?? 0,
  };
}

/** Every melee class, in melee's order. */
export function meleeClasses(): Archetype[] {
  return content.playerTypes.map(classFromMelee);
}

/**
 * `library` with every melee class and the skills they learn. What the
 * library already has under the same id (an edited copy, say) is kept.
 */
export function withMeleeClasses(library: Library): Library {
  const types = new Set(library.archetypes.map((a) => a.id));
  const skills = new Set(library.skills.map((s) => s.id));
  const missing = meleeClasses().filter((a) => !types.has(a.id));
  const learned = content.playerTypes
    .flatMap((def) => def.skills ?? [])
    .filter((s) => !skills.has(s.id) && skills.add(s.id));
  if (missing.length === 0 && learned.length === 0) return library;
  return {
    ...library,
    skills: [...library.skills, ...learned.map((s) => structuredClone(s))],
    archetypes: [...library.archetypes, ...missing],
  };
}
