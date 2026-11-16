import {
  STAT_NAMES,
  TRAITS,
  isCombatantDef,
  type Skill,
  type Stats,
} from "@jforge/melee/shared";
import { compileRoster } from "./compile";
import { clampLevel } from "./progression";
import {
  ALL_GEAR_CATEGORIES,
  GEAR_CATEGORIES,
  GEAR_SLOTS,
  type Archetype,
  type GearSlot,
  type Character,
  type Gear,
  type Library,
} from "./types";

/** The four lists of a library. */
export type Collection = "skills" | "gear" | "archetypes" | "characters";
type Item<K extends Collection> = Library[K][number];

export function emptyLibrary(): Library {
  return { version: 1, skills: [], gear: [], archetypes: [], characters: [] };
}

/** The same value for every stat. */
export function flatStats(value: number): Stats {
  return Object.fromEntries(STAT_NAMES.map((s) => [s, value])) as Stats;
}

const PREFIX: Record<Collection, string> = {
  skills: "skill",
  gear: "gear",
  archetypes: "type",
  characters: "unit",
};

/** An id no item of that list uses yet: "skill-1", "skill-2", ... */
export function nextId(library: Library, collection: Collection): string {
  const used = new Set(library[collection].map((item) => item.id));
  for (let n = 1; ; n++) {
    const id = `${PREFIX[collection]}-${n}`;
    if (!used.has(id)) return id;
  }
}

/** Adds an item, or replaces the one with the same id. */
export function upsert<K extends Collection>(
  library: Library,
  collection: K,
  item: Item<K>,
): Library {
  const items = library[collection] as Item<K>[];
  const exists = items.some((other) => other.id === item.id);
  return {
    ...library,
    [collection]: exists
      ? items.map((other) => (other.id === item.id ? item : other))
      : [...items, item],
  };
}

/**
 * Removes an item and whatever pointed at it: a removed skill is unlearned,
 * removed gear is taken off, and a removed archetype takes its characters
 * with it.
 */
export function remove(
  library: Library,
  collection: Collection,
  id: string,
): Library {
  const next: Library = {
    ...library,
    [collection]: library[collection].filter((item) => item.id !== id),
  };
  if (collection === "skills") {
    next.archetypes = next.archetypes.map((a) => ({
      ...a,
      skills: a.skills.filter((unlock) => unlock.skillId !== id),
    }));
  } else if (collection === "gear") {
    next.characters = next.characters.map((c) => ({
      ...c,
      gear: Object.fromEntries(
        Object.entries(c.gear).filter(([, gearId]) => gearId !== id),
      ),
    }));
  } else if (collection === "archetypes") {
    next.characters = next.characters.filter((c) => c.archetypeId !== id);
  }
  return next;
}

export function blankSkill(id: string): Skill {
  return {
    id,
    name: "New skill",
    description: "",
    mpCost: 5,
    target: "enemy",
    area: "single",
    effect: { type: "damage", kind: "magical", element: "fire", power: 1 },
  };
}

export function blankGear(id: string): Gear {
  return {
    id,
    name: "New gear",
    slot: "armor",
    bonuses: [{ stat: "defense", op: "add", value: 5 }],
  };
}

export function blankArchetype(id: string, kind: Archetype["kind"]): Archetype {
  return {
    id,
    name: kind === "class" ? "New class" : "New enemy",
    kind,
    portrait: kind === "class" ? "fighter" : "slime",
    baseStats: {
      maxHp: 100,
      maxMp: 20,
      attack: 15,
      magic: 10,
      defense: 10,
      spirit: 10,
      speed: 10,
    },
    growth: {
      maxHp: 8,
      maxMp: 2,
      attack: 1.5,
      magic: 1,
      defense: 1,
      spirit: 1,
      speed: 0.2,
    },
    weapon: {
      id: `${id}-weapon`,
      name: kind === "class" ? "Fists" : "Claws",
      columns: 1,
      depth: 1,
      damageType: kind === "class" ? "crush" : "slash",
      kind: "melee",
    },
    skills: [],
    traits: [],
    preferredRow: 0,
  };
}

export function blankCharacter(id: string, archetype: Archetype): Character {
  return {
    id,
    name: archetype.name,
    archetypeId: archetype.id,
    level: 1,
    xp: 0,
    gear: {},
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isStats = (v: unknown) =>
  isRecord(v) && STAT_NAMES.every((s) => isNumber(v[s]));
const named = (v: unknown): v is Record<string, unknown> =>
  isRecord(v) && typeof v.id === "string" && typeof v.name === "string";

function isGear(v: unknown): boolean {
  return (
    named(v) &&
    GEAR_SLOTS.includes(v.slot as never) &&
    (v.category === undefined ||
      (GEAR_CATEGORIES[v.slot as GearSlot] as readonly unknown[]).includes(
        v.category,
      )) &&
    Array.isArray(v.bonuses) &&
    v.bonuses.every(
      (b) =>
        isRecord(b) &&
        STAT_NAMES.includes(b.stat as never) &&
        (b.op === "add" || b.op === "mul") &&
        isNumber(b.value),
    )
  );
}

function isArchetype(v: unknown): boolean {
  return (
    named(v) &&
    (v.kind === "class" || v.kind === "enemy") &&
    typeof v.portrait === "string" &&
    isStats(v.baseStats) &&
    isStats(v.growth) &&
    isRecord(v.weapon) &&
    Array.isArray(v.skills) &&
    v.skills.every(
      (u) => isRecord(u) && typeof u.skillId === "string" && isNumber(u.level),
    ) &&
    Array.isArray(v.traits) &&
    v.traits.every((t) => TRAITS.includes(t as never)) &&
    isNumber(v.preferredRow) &&
    (v.proficiencies === undefined ||
      (Array.isArray(v.proficiencies) &&
        v.proficiencies.every((c) => ALL_GEAR_CATEGORIES.includes(c as never))))
  );
}

function isCharacter(v: unknown): boolean {
  return (
    named(v) &&
    typeof v.archetypeId === "string" &&
    isNumber(v.level) &&
    isNumber(v.xp) &&
    isRecord(v.gear) &&
    Object.values(v.gear).every((id) => typeof id === "string")
  );
}

/** Where the library is saved in the browser (jrpg reads it too). */
export const LIBRARY_STORAGE_KEY = "jforge.char.library";

/**
 * Reads an exported or saved library. Null unless it is well formed and
 * every character in it compiles into a combatant melee accepts.
 */
export function parseLibrary(text: string | null): Library | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== 1) return null;
  const { skills, gear, archetypes, characters } = data;
  if (
    !Array.isArray(skills) ||
    !skills.every((s) => named(s) && isRecord(s.effect)) ||
    !Array.isArray(gear) ||
    !gear.every(isGear) ||
    !Array.isArray(archetypes) ||
    !archetypes.every(isArchetype) ||
    !Array.isArray(characters) ||
    !characters.every(isCharacter)
  ) {
    return null;
  }
  const library = {
    version: 1,
    skills,
    gear,
    archetypes,
    characters,
  } as Library;
  library.characters = library.characters.map((c) => ({
    ...c,
    level: clampLevel(c.level),
  }));
  const roster = compileRoster(library);
  return [...roster.party, ...roster.monsters].every(isCombatantDef)
    ? library
    : null;
}
