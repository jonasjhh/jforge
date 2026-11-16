import {
  STAT_NAMES,
  content,
  type CombatantDef,
  type Stats,
} from "@jforge/melee/shared";
import { canUse } from "./gear";
import type {
  Archetype,
  Character,
  Gear,
  GearCategory,
  Library,
} from "./types";

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

/**
 * What each melee class can use. Fighters and lancers take blades and
 * polearms and any armor but robes; archers and rogues bows and daggers
 * in light armor; casters staves and foci in robes, some also in light
 * armor. Each class's own weapon is among its categories.
 */
export const MELEE_PROFICIENCIES: Record<string, GearCategory[]> = {
  fighter: ["blade", "polearm", "heavy", "light"],
  lancer: ["polearm", "blade", "heavy", "light"],
  paladin: ["blade", "heavy", "light"],
  archer: ["bow", "dagger", "light"],
  rogue: ["dagger", "bow", "light"],
  mage: ["staff", "focus", "robe"],
  healer: ["staff", "robe", "light"],
  chronomancer: ["focus", "staff", "robe"],
  warlock: ["focus", "dagger", "robe", "light"],
  geomancer: ["staff", "focus", "robe", "light"],
};

/** The category of each melee class's own weapon, by melee type id. */
export const MELEE_WEAPON_CATEGORY: Record<string, GearCategory> = {
  fighter: "blade",
  lancer: "polearm",
  paladin: "blade",
  archer: "bow",
  rogue: "dagger",
  mage: "staff",
  healer: "staff",
  chronomancer: "focus",
  warlock: "focus",
  geomancer: "staff",
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
    category: "light",
    bonuses: [
      { stat: "defense", op: "add", value: 3 },
      { stat: "maxHp", op: "add", value: 8 },
    ],
  },
  {
    id: "melee-gear-robe",
    name: "Traveller's Robe",
    slot: "armor",
    category: "robe",
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
    ...(MELEE_PROFICIENCIES[def.id]
      ? { proficiencies: [...MELEE_PROFICIENCIES[def.id]!] }
      : {}),
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
    ...(MELEE_WEAPON_CATEGORY[def.id]
      ? { category: MELEE_WEAPON_CATEGORY[def.id] }
      : {}),
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
 * (a jerkin if not), or whichever of the two the class can use. Only gear
 * `library` has and the class can use is given.
 */
export function starterKit(library: Library, character: Character): Character {
  const type = library.archetypes.find((a) => a.id === character.archetypeId);
  if (!type || type.kind !== "class") return character;
  const caster = type.baseStats.magic > type.baseStats.attack;
  const armor = caster
    ? ["melee-gear-robe", "melee-gear-jerkin"]
    : ["melee-gear-jerkin", "melee-gear-robe"];
  const wanted = [
    type.id.startsWith("melee-")
      ? meleeWeaponId(type.id.slice("melee-".length))
      : undefined,
    ...armor,
  ];
  const gear = { ...character.gear };
  for (const id of wanted) {
    const piece = library.gear.find((g) => g.id === id);
    if (piece && gear[piece.slot] === undefined && canUse(type, piece)) {
      gear[piece.slot] = piece.id;
    }
  }
  return { ...character, gear };
}

/** Every melee class, in melee's order. */
export function meleeClasses(): Archetype[] {
  return content.playerTypes.map(classFromMelee);
}

/**
 * `library` with what came before gear had categories filled in: the
 * melee classes' proficiencies and the basic gear's categories, where they
 * have none. The library itself if nothing was missing.
 */
function withCategories(library: Library): Library {
  const basic = new Map(basicGear().map((g) => [g.id, g.category]));
  let changed = false;
  const archetypes = library.archetypes.map((a) => {
    const id = a.id.startsWith("melee-") ? a.id.slice("melee-".length) : "";
    const known = MELEE_PROFICIENCIES[id];
    if (a.proficiencies !== undefined || !known) return a;
    changed = true;
    return { ...a, proficiencies: [...known] };
  });
  const gear = library.gear.map((g) => {
    const category = basic.get(g.id);
    if (g.category !== undefined || category === undefined) return g;
    changed = true;
    return { ...g, category };
  });
  return changed ? { ...library, archetypes, gear } : library;
}

/**
 * `library` with every melee class, the skills they learn, the basic gear
 * and a hero of each class wearing it. What the library already has under
 * the same id (an edited copy, say) is kept, given the proficiencies or
 * category it was saved without.
 */
export function withMeleeClasses(saved: Library): Library {
  const library = withCategories(saved);
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
