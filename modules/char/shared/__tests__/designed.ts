import { content } from "@jforge/melee/shared";
import { starterLibrary } from "../starter";
import type { Archetype, Character, Library } from "../types";

const { cleave, fireball, firebolt, heal } = content;

/** Two classes designed in char (not melee's), as tests' examples. */
export const DESIGNED_CLASSES: Archetype[] = [
  {
    id: "type-squire",
    name: "Squire",
    kind: "class",
    portrait: "fighter",
    baseStats: {
      maxHp: 110,
      maxMp: 10,
      attack: 16,
      magic: 4,
      defense: 12,
      spirit: 8,
      speed: 10,
    },
    growth: {
      maxHp: 10,
      maxMp: 1,
      attack: 2,
      magic: 0.2,
      defense: 1.5,
      spirit: 0.5,
      speed: 0.2,
    },
    weapon: {
      id: "type-squire-weapon",
      name: "Fists",
      columns: 1,
      depth: 1,
      damageType: "crush",
      kind: "melee",
    },
    skills: [{ skillId: cleave.id, level: 2 }],
    traits: [],
    preferredRow: 0,
    proficiencies: ["blade", "polearm", "heavy", "light"],
  },
  {
    id: "type-scholar",
    name: "Scholar",
    kind: "class",
    portrait: "mage",
    baseStats: {
      maxHp: 70,
      maxMp: 40,
      attack: 6,
      magic: 16,
      defense: 6,
      spirit: 12,
      speed: 11,
    },
    growth: {
      maxHp: 5,
      maxMp: 5,
      attack: 0.3,
      magic: 2,
      defense: 0.5,
      spirit: 1.5,
      speed: 0.2,
    },
    weapon: {
      id: "type-scholar-weapon",
      name: "Fists",
      columns: 1,
      depth: 1,
      damageType: "crush",
      kind: "melee",
    },
    skills: [
      { skillId: firebolt.id, level: 1 },
      { skillId: heal.id, level: 2 },
      { skillId: fireball.id, level: 4 },
    ],
    traits: [],
    preferredRow: 2,
    proficiencies: ["staff", "focus", "robe"],
  },
];

/** A character of each designed class, in the starter's gear. */
export const DESIGNED_CHARACTERS: Character[] = [
  {
    id: "unit-1",
    name: "Bram",
    archetypeId: "type-squire",
    level: 3,
    xp: 0,
    gear: { weapon: "gear-sword", armor: "gear-mail" },
  },
  {
    id: "unit-2",
    name: "Ilse",
    archetypeId: "type-scholar",
    level: 3,
    xp: 0,
    gear: { weapon: "gear-staff", armor: "gear-robe" },
  },
];

/**
 * The starter library with the designed classes and their characters
 * first: Bram (Squire), Ilse (Scholar), then the starter's own.
 */
export function designedLibrary(): Library {
  const library = starterLibrary();
  return {
    ...library,
    archetypes: [...DESIGNED_CLASSES, ...library.archetypes],
    characters: [...DESIGNED_CHARACTERS, ...library.characters],
  };
}
