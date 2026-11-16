import type {
  Skill,
  StatName,
  Stats,
  Trait,
  Weapon,
} from "@jforge/melee/shared";

// Everything a player designs in char. Plain data, so a library can be
// saved, exported and imported. Skills and weapons are melee's own types:
// what is designed here is exactly what a battle uses.

export const GEAR_SLOTS = ["weapon", "armor", "accessory"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

/** One change a piece of gear makes to a stat: +5 attack, or x1.1 speed. */
export interface StatBonus {
  stat: StatName;
  op: "add" | "mul";
  value: number;
}

/** A piece of equipment. Worn in its slot, it changes the wearer's stats. */
export interface Gear {
  id: string;
  name: string;
  slot: GearSlot;
  bonuses: StatBonus[];
  /** For the weapon slot: how the wearer attacks while holding it. */
  weapon?: Weapon;
}

/** A skill an archetype learns once it reaches `level`. */
export interface SkillUnlock {
  skillId: string;
  level: number;
}

/**
 * A class (for party members) or an enemy type: the template characters
 * are made from. Stats at a level are `baseStats` plus `growth` for every
 * level above the first.
 */
export interface Archetype {
  id: string;
  name: string;
  kind: "class" | "enemy";
  /** The built-in melee type whose icon it wears. */
  portrait: string;
  baseStats: Stats;
  /** Added per level above 1; fractions are fine (0.5 = +1 every 2 levels). */
  growth: Stats;
  /** What it attacks with when no weapon is equipped. */
  weapon: Weapon;
  skills: SkillUnlock[];
  traits: Trait[];
  /** Row it prefers when placed automatically: 0 front, 1 middle, 2 back. */
  preferredRow: number;
  /** For enemies: how much of an encounter's budget one of them takes. */
  threat: number;
}

/** One character or enemy: an archetype at a level, wearing gear. */
export interface Character {
  id: string;
  name: string;
  archetypeId: string;
  level: number;
  /** Experience gathered toward the next level. */
  xp: number;
  /** Gear ids by slot. */
  gear: Partial<Record<GearSlot, string>>;
}

/** Everything designed on this device. */
export interface Library {
  version: 1;
  skills: Skill[];
  gear: Gear[];
  archetypes: Archetype[];
  characters: Character[];
}
