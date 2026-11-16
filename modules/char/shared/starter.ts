import { content } from "@jforge/melee/shared";
import type { Library } from "./types";

const { bow, cleave, fireball, firebolt, heal, staff, sword } = content;

/**
 * What a new device starts with: a few skills, gear and types lifted from
 * melee's own content, so there is something to edit and to send to melee
 * straight away.
 */
export function starterLibrary(): Library {
  return {
    version: 1,
    skills: [cleave, firebolt, fireball, heal].map((s) => structuredClone(s)),
    gear: [
      {
        id: "gear-sword",
        name: "Iron Sword",
        slot: "weapon",
        bonuses: [{ stat: "attack", op: "add", value: 6 }],
        weapon: { ...sword, id: "gear-sword", name: "Iron Sword" },
      },
      {
        id: "gear-bow",
        name: "Short Bow",
        slot: "weapon",
        bonuses: [{ stat: "attack", op: "add", value: 4 }],
        weapon: { ...bow, id: "gear-bow", name: "Short Bow" },
      },
      {
        id: "gear-staff",
        name: "Oak Staff",
        slot: "weapon",
        bonuses: [{ stat: "magic", op: "add", value: 6 }],
        weapon: { ...staff, id: "gear-staff", name: "Oak Staff" },
      },
      {
        id: "gear-mail",
        name: "Chain Mail",
        slot: "armor",
        bonuses: [
          { stat: "defense", op: "add", value: 8 },
          { stat: "speed", op: "mul", value: 0.9 },
        ],
      },
      {
        id: "gear-robe",
        name: "Silk Robe",
        slot: "armor",
        bonuses: [
          { stat: "spirit", op: "add", value: 6 },
          { stat: "maxMp", op: "add", value: 15 },
        ],
      },
      {
        id: "gear-ring",
        name: "Swift Ring",
        slot: "accessory",
        bonuses: [{ stat: "speed", op: "mul", value: 1.15 }],
      },
    ],
    archetypes: [
      {
        id: "type-knight",
        name: "Knight",
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
          id: "type-knight-weapon",
          name: "Fists",
          columns: 1,
          depth: 1,
          damageType: "crush",
          kind: "melee",
        },
        skills: [{ skillId: cleave.id, level: 2 }],
        traits: [],
        preferredRow: 0,
      },
      {
        id: "type-sage",
        name: "Sage",
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
          id: "type-sage-weapon",
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
      },
      {
        id: "type-goblin",
        name: "Goblin",
        kind: "enemy",
        portrait: "wolf",
        baseStats: {
          maxHp: 45,
          maxMp: 0,
          attack: 14,
          magic: 0,
          defense: 6,
          spirit: 4,
          speed: 12,
        },
        growth: {
          maxHp: 6,
          maxMp: 0,
          attack: 1.5,
          magic: 0,
          defense: 0.8,
          spirit: 0.5,
          speed: 0.3,
        },
        weapon: {
          id: "type-goblin-weapon",
          name: "Rusty Knife",
          columns: 1,
          depth: 1,
          damageType: "slash",
          kind: "melee",
        },
        skills: [],
        traits: [],
        preferredRow: 0,
      },
    ],
    characters: [
      {
        id: "unit-1",
        name: "Aldric",
        archetypeId: "type-knight",
        level: 3,
        xp: 0,
        gear: { weapon: "gear-sword", armor: "gear-mail" },
      },
      {
        id: "unit-2",
        name: "Mira",
        archetypeId: "type-sage",
        level: 3,
        xp: 0,
        gear: { weapon: "gear-staff", armor: "gear-robe" },
      },
      {
        id: "unit-3",
        name: "Goblin",
        archetypeId: "type-goblin",
        level: 2,
        xp: 0,
        gear: {},
      },
    ],
  };
}
