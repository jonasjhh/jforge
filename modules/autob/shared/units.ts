import {
  creatureOf,
  toCreature,
  type Archetype,
  type Library,
  type StatName,
  type Stats,
} from "@jforge/rules/core";
import { estimateThreat, type CombatantDef } from "@jforge/battle";

// The units of autob are char's classes. Each copy bought is a unit; three
// of a class at the same star merge into one a star higher.

/** A unit the player owns, on the bench or on the board. */
export interface OwnedUnit {
  /** Unique within the run. */
  uid: string;
  /** The class (char archetype) it is. */
  classId: string;
  /** 1 to MAX_STARS. */
  stars: number;
}

export const MAX_STARS = 3;
/** How many copies merge into one a star higher. */
export const MERGE_COPIES = 3;
/** What a star multiplies STAR_STATS by: 1★, 2★, 3★. */
export const STAR_POWER = [1, 1.8, 3.24] as const;
/** The stats stars raise; the rest stay the class's own. */
export const STAR_STATS: StatName[] = ["maxHp", "attack", "magic"];
/** Cost tiers: the shop's prices, from 1 (cheapest) to TIERS. */
export const TIERS = 3;

/** The classes the shop sells: every class in the library. */
export function shopClasses(library: Library): Archetype[] {
  return library.archetypes.filter((a) => a.kind === "class" && !a.obstacle);
}

const plain = (archetype: Archetype) => ({
  id: archetype.id,
  name: archetype.name,
  archetypeId: archetype.id,
  gear: {},
});

/** A class's threat at 1★, which sets its cost tier. */
export function classThreat(library: Library, archetype: Archetype): number {
  const def = toCreature(library, plain(archetype));
  return def ? estimateThreat(def) : 0;
}

/**
 * Each class's cost tier: the classes ranked by threat, cut into TIERS
 * equal shares, weakest first (ties by id). A designed class gets its
 * tier the same way.
 */
export function costTiers(library: Library): Record<string, number> {
  const ranked = shopClasses(library)
    .map((a) => ({ id: a.id, threat: classThreat(library, a) }))
    .sort((a, b) => a.threat - b.threat || a.id.localeCompare(b.id));
  return Object.fromEntries(
    ranked.map((c, i) => [
      c.id,
      1 + Math.floor((i * TIERS) / Math.max(ranked.length, 1)),
    ]),
  );
}

/** How many 1★ copies a unit is made of. */
export const copiesIn = (stars: number) => MERGE_COPIES ** (stars - 1);

/** What selling a unit pays back: what its copies cost. */
export const sellValue = (cost: number, stars: number) =>
  cost * copiesIn(stars);

/** A class's stats raised to a star. */
export function starStats(base: Stats, stars: number): Stats {
  const power = STAR_POWER[stars - 1] ?? 1;
  const stats = { ...base };
  for (const stat of STAR_STATS) stats[stat] = Math.round(base[stat] * power);
  return stats;
}

/** How a unit is named: its class, with its stars past the first. */
export function unitName(name: string, stars: number): string {
  return stars > 1 ? `${name} ${"★".repeat(stars)}` : name;
}

/** The melee combatant a unit fights as; null if its class is gone. */
export function unitDef(
  library: Library,
  unit: OwnedUnit,
): CombatantDef | null {
  const archetype = library.archetypes.find((a) => a.id === unit.classId);
  if (!archetype) return null;
  const def = toCreature(
    library,
    { ...plain(archetype), id: unit.uid },
    starStats(archetype.baseStats, unit.stars),
  );
  return def && { ...def, name: unitName(archetype.name, unit.stars) };
}

/** A creature from the library as a monster, with its threat to spend. */
export function monsterDef(
  library: Library,
  archetypeId: string,
): CombatantDef | null {
  const def = creatureOf(library, archetypeId);
  return def && { ...def, threat: estimateThreat(def) };
}
