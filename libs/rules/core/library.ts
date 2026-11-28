import {
  SAVE_VERSION,
  STAT_NAMES,
  TRAITS,
  isCombatantDef,
  type Stats,
} from "@jforge/melee/shared";
import { compileRoster } from "./compile";
import {
  ALL_GEAR_CATEGORIES,
  GEAR_CATEGORIES,
  GEAR_SLOTS,
  type Archetype,
  type GearSlot,
  type Character,
  type Library,
} from "./types";

export function emptyLibrary(): Library {
  return {
    version: SAVE_VERSION,
    skills: [],
    gear: [],
    archetypes: [],
    characters: [],
  };
}

/** The same value for every stat. */
export function flatStats(value: number): Stats {
  return Object.fromEntries(STAT_NAMES.map((s) => [s, value])) as Stats;
}

/** A plain archetype to build on: average stats, bare hands, no skills. */
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

/** A character of `archetype`, named after it, in no gear. */
export function blankCharacter(id: string, archetype: Archetype): Character {
  return {
    id,
    name: archetype.name,
    archetypeId: archetype.id,
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
    isRecord(v.weapon) &&
    Array.isArray(v.skills) &&
    v.skills.every((id) => typeof id === "string") &&
    Array.isArray(v.traits) &&
    v.traits.every((t) => TRAITS.includes(t as never)) &&
    isNumber(v.preferredRow) &&
    (v.proficiencies === undefined ||
      (Array.isArray(v.proficiencies) &&
        v.proficiencies.every((c) =>
          ALL_GEAR_CATEGORIES.includes(c as never),
        ))) &&
    (v.obstacle === undefined || typeof v.obstacle === "boolean") &&
    (v.comesFrom === undefined ||
      (Array.isArray(v.comesFrom) &&
        v.comesFrom.every((id) => typeof id === "string")))
  );
}

function isCharacter(v: unknown): boolean {
  return (
    named(v) &&
    typeof v.archetypeId === "string" &&
    isRecord(v.gear) &&
    Object.values(v.gear).every((id) => typeof id === "string")
  );
}

/**
 * Reads a saved library (the one a run was dealt). Null unless it is well
 * formed and every character in it compiles into a combatant melee accepts.
 */
export function parseLibrary(text: string | null): Library | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== SAVE_VERSION) return null;
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
    version: SAVE_VERSION,
    skills,
    gear,
    archetypes,
    characters,
  } as Library;
  const roster = compileRoster(library);
  return [...roster.party, ...roster.monsters].every(isCombatantDef)
    ? library
    : null;
}
