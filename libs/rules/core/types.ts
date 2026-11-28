import type {
  SAVE_VERSION,
  Skill,
  StatName,
  Stats,
  Trait,
  Weapon,
} from "@jforge/melee/shared";

// The shapes of jforge's content: classes, enemy types, summons, skills, gear and
// characters, written as code in @jforge/content and read by the games and
// char's codex. Plain data, so a run can save the library it was dealt.
// Skills and weapons are melee's own types: what is written here is
// exactly what a battle uses.

export const GEAR_SLOTS = ["weapon", "armour", "accessory"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

/**
 * What sort of weapon or armour a piece is. A class names the categories
 * it can use; accessories have none, so anyone wears them.
 */
export const GEAR_CATEGORIES = {
  weapon: ["blade", "polearm", "dagger", "bow", "staff", "focus"],
  armour: ["heavy", "light", "robe"],
  accessory: [],
} as const satisfies Record<GearSlot, readonly string[]>;
export type GearCategory = (typeof GEAR_CATEGORIES)[GearSlot][number];
/** How each category is called. */
export const GEAR_CATEGORY_NAMES: Record<GearCategory, string> = {
  blade: "Blade",
  polearm: "Polearm",
  dagger: "Dagger",
  bow: "Bow",
  staff: "Staff",
  focus: "Focus",
  heavy: "Heavy armour",
  light: "Light armour",
  robe: "Robe",
};
export const ALL_GEAR_CATEGORIES: GearCategory[] = [
  ...GEAR_CATEGORIES.weapon,
  ...GEAR_CATEGORIES.armour,
];

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
  /** Its category, one of its slot's; without one anyone can wear it. */
  category?: GearCategory;
  bonuses: StatBonus[];
  /** For the weapon slot: how the wearer attacks while holding it. */
  weapon?: Weapon;
}

/**
 * A class (for party members), an enemy type (for the other side) or a
 * summon (a creature a skill puts in, on its caster's side unless the
 * skill says otherwise): the template characters and creatures are made
 * from. How it grows with levels is up to the game that uses it.
 */
export interface Archetype {
  id: string;
  name: string;
  kind: "class" | "enemy" | "summon";
  /** The built-in melee type whose icon it wears. */
  portrait: string;
  /** Its stats at level 1. */
  baseStats: Stats;
  /** What it attacks with when no weapon is equipped. */
  weapon: Weapon;
  /** The ids of the skills it has. */
  skills: string[];
  traits: Trait[];
  /** Row it prefers when placed automatically: 0 front, 1 middle, 2 back. */
  preferredRow: number;
  /**
   * The gear categories its characters can use; without the list they
   * can use any. Gear with no category fits everyone either way.
   */
  proficiencies?: GearCategory[];
  /** Takes up a cell and never acts, like a boulder (for summons). */
  obstacle?: boolean;
  /**
   * Classes only: the classes it can be reached from, any one of them.
   * Without it, or empty, it is a base class. See classGraph.ts.
   */
  comesFrom?: string[];
}

/** One character or enemy: an archetype wearing gear. */
export interface Character {
  id: string;
  name: string;
  archetypeId: string;
  /** Gear ids by slot. */
  gear: Partial<Record<GearSlot, string>>;
}

/** A set of content: the catalogue, or what one game uses of it. */
export interface Library {
  version: typeof SAVE_VERSION;
  skills: Skill[];
  gear: Gear[];
  archetypes: Archetype[];
  characters: Character[];
}
