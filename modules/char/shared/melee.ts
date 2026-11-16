import {
  STAT_NAMES,
  content,
  type CombatantDef,
  type Stats,
} from "@jforge/melee/shared";
import type { Archetype, Character, Gear, Library } from "./types";

// Melee's own classes as char classes, so every one of them can be
// levelled, geared, edited and sent to jrpg like a designed class, each
// with a hero of that class in basic gear.

/** The level at which a melee class has exactly melee's stats. */
export const MELEE_CLASS_LEVEL = 3;
/** Growth per level, as a share of the stats at level 1. */
export const MELEE_GROWTH = 0.08;
/** Speed grows slower: it decides how often a unit acts. */
export const MELEE_SPEED_GROWTH = 0.02;
/** The level each skill is learned at, in melee's order. */
export const MELEE_SKILL_LEVELS = [1, 2, 4, 6, 8, 10];

export const meleeClassId = (id: string) => `melee-${id}`;
export const meleeHeroId = (id: string) => `melee-hero-${id}`;
export const meleeWeaponId = (id: string) => `melee-gear-${id}`;

/** A hero of each melee class, by melee type id. */
export const MELEE_HEROES: Record<string, string> = {
  archer: "Brann",
  healer: "Isolde",
  rogue: "Vex",
  lancer: "Tamsin",
  chronomancer: "Orrin",
  paladin: "Hale",
  geomancer: "Wren",
  fighter: "Cade",
  warlock: "Sable",
  mage: "Lucan",
};

/** What a basic weapon adds to its class's best of these. */
const BASIC_WEAPON_BONUS = 3;
const WEAPON_STATS = ["attack", "magic", "spirit"] as const;

/** Basic armor: a jerkin, or a robe for casters. */
export const BASIC_ARMOR: Gear[] = [
  {
    id: "melee-gear-jerkin",
    name: "Traveller's Jerkin",
    slot: "armor",
    bonuses: [
      { stat: "defense", op: "add", value: 3 },
      { stat: "maxHp", op: "add", value: 8 },
    ],
  },
  {
    id: "melee-gear-robe",
    name: "Traveller's Robe",
    slot: "armor",
    bonuses: [
      { stat: "spirit", op: "add", value: 3 },
      { stat: "maxMp", op: "add", value: 10 },
    ],
  },
];

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

/** A melee class's own weapon as plain gear, adding to its best stat. */
export function basicWeapon(def: CombatantDef): Gear {
  const stat = WEAPON_STATS.reduce((top, at) =>
    def.stats[at] > def.stats[top] ? at : top,
  );
  const id = meleeWeaponId(def.id);
  const name = `${def.name}'s ${def.weapon.name}`;
  return {
    id,
    name,
    slot: "weapon",
    bonuses: [{ stat, op: "add", value: BASIC_WEAPON_BONUS }],
    weapon: { ...structuredClone(def.weapon), id, name },
  };
}

/** Every piece of basic gear: each melee class's weapon, and the armor. */
export function basicGear(): Gear[] {
  return [...content.playerTypes.map(basicWeapon), ...BASIC_ARMOR];
}

/**
 * `character` in basic gear, in the slots they have empty: their melee
 * class's own weapon, and a robe if their class's magic beats its attack
 * (a jerkin if not). Only gear `library` has is given.
 */
export function starterKit(library: Library, character: Character): Character {
  const type = library.archetypes.find((a) => a.id === character.archetypeId);
  if (!type || type.kind !== "class") return character;
  const caster = type.baseStats.magic > type.baseStats.attack;
  const wanted = [
    type.id.startsWith("melee-")
      ? meleeWeaponId(type.id.slice("melee-".length))
      : undefined,
    caster ? "melee-gear-robe" : "melee-gear-jerkin",
  ];
  const gear = { ...character.gear };
  for (const id of wanted) {
    const piece = library.gear.find((g) => g.id === id);
    if (piece && gear[piece.slot] === undefined) gear[piece.slot] = piece.id;
  }
  return { ...character, gear };
}

/** Every melee class, in melee's order. */
export function meleeClasses(): Archetype[] {
  return content.playerTypes.map(classFromMelee);
}

/**
 * `library` with every melee class, the skills they learn, the basic gear
 * and a hero of each class wearing it. What the library already has under
 * the same id (an edited copy, say) is kept.
 */
export function withMeleeClasses(library: Library): Library {
  const types = new Set(library.archetypes.map((a) => a.id));
  const skills = new Set(library.skills.map((s) => s.id));
  const gearIds = new Set(library.gear.map((g) => g.id));
  const people = new Set(library.characters.map((c) => c.id));
  const missing = meleeClasses().filter((a) => !types.has(a.id));
  const learned = content.playerTypes
    .flatMap((def) => def.skills ?? [])
    .filter((s) => !skills.has(s.id) && skills.add(s.id));
  const gear = basicGear().filter((g) => !gearIds.has(g.id));
  const heroes = content.playerTypes.filter(
    (def) => MELEE_HEROES[def.id] && !people.has(meleeHeroId(def.id)),
  );
  if (
    missing.length === 0 &&
    learned.length === 0 &&
    gear.length === 0 &&
    heroes.length === 0
  ) {
    return library;
  }
  const added: Library = {
    ...library,
    skills: [...library.skills, ...learned.map((s) => structuredClone(s))],
    gear: [...library.gear, ...gear],
    archetypes: [...library.archetypes, ...missing],
  };
  return {
    ...added,
    characters: [
      ...library.characters,
      ...heroes.map((def) =>
        starterKit(added, {
          id: meleeHeroId(def.id),
          name: MELEE_HEROES[def.id]!,
          archetypeId: meleeClassId(def.id),
          level: 1,
          xp: 0,
          gear: {},
        }),
      ),
    ],
  };
}
