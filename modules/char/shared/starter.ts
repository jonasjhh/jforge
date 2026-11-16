import { SAVE_VERSION, content } from "@jforge/melee/shared";
import { withMeleeClasses } from "./melee";
import type { Library } from "./types";

const { bow, cleave, fireball, firebolt, heal, staff, sword } = content;

/**
 * What a new device starts with: a few skills, gear and types lifted from
 * melee's own content, so there is something to edit and to send to melee
 * straight away, and every melee class.
 */
export function starterLibrary(): Library {
  return withMeleeClasses(starterDesigns());
}

function starterDesigns(): Library {
  return {
    version: SAVE_VERSION,
    skills: [cleave, firebolt, fireball, heal].map((s) => structuredClone(s)),
    gear: [
      {
        id: "gear-sword",
        name: "Iron Sword",
        slot: "weapon",
        category: "blade",
        bonuses: [{ stat: "attack", op: "add", value: 6 }],
        weapon: { ...sword, id: "gear-sword", name: "Iron Sword" },
      },
      {
        id: "gear-bow",
        name: "Short Bow",
        slot: "weapon",
        category: "bow",
        bonuses: [{ stat: "attack", op: "add", value: 4 }],
        weapon: { ...bow, id: "gear-bow", name: "Short Bow" },
      },
      {
        id: "gear-staff",
        name: "Oak Staff",
        slot: "weapon",
        category: "staff",
        bonuses: [{ stat: "magic", op: "add", value: 6 }],
        weapon: { ...staff, id: "gear-staff", name: "Oak Staff" },
      },
      {
        id: "gear-mail",
        name: "Chain Mail",
        slot: "armor",
        category: "heavy",
        bonuses: [
          { stat: "defense", op: "add", value: 8 },
          { stat: "speed", op: "mul", value: 0.9 },
        ],
      },
      {
        id: "gear-robe",
        name: "Silk Robe",
        slot: "armor",
        category: "robe",
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
