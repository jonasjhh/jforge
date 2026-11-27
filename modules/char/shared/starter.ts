import { SAVE_VERSION, content } from "@jforge/melee/shared";
import { withMeleeClasses } from "./melee";
import { GAMES, type Archetype, type Library } from "./types";

const { bow, cleave, daggers, fireball, firebolt, heal, staff, sword } =
  content;

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
        games: [...GAMES],
      },
      ...baseClasses(),
    ],
    characters: [
      {
        id: "unit-3",
        name: "Goblin",
        archetypeId: "type-goblin",
        gear: {},
      },
    ],
  };
}

/**
 * The base classes of the class graph (see docs/progression.md, section 6):
 * strength, agility and magic, where every path starts. They have no skills
 * yet and no game uses them yet; their stats are close to melee's Fighter,
 * Rogue, and Mage and Healer.
 */
function baseClasses(): Archetype[] {
  const base = (
    id: string,
    name: string,
    portrait: string,
    rest: Pick<
      Archetype,
      "baseStats" | "weapon" | "preferredRow" | "proficiencies"
    >,
  ): Archetype => ({
    id,
    name,
    kind: "class",
    portrait,
    skills: [],
    traits: [],
    games: [],
    ...rest,
    weapon: { ...structuredClone(rest.weapon), id: `${id}-weapon` },
  });
  return [
    base("class-squire", "Squire", "fighter", {
      baseStats: {
        maxHp: 120,
        maxMp: 10,
        attack: 22,
        magic: 4,
        defense: 18,
        spirit: 8,
        speed: 10,
      },
      weapon: sword,
      preferredRow: 0,
      proficiencies: ["blade", "polearm", "heavy", "light"],
    }),
    base("class-scout", "Scout", "rogue", {
      baseStats: {
        maxHp: 80,
        maxMp: 20,
        attack: 19,
        magic: 4,
        defense: 9,
        spirit: 9,
        speed: 15,
      },
      weapon: daggers,
      preferredRow: 1,
      proficiencies: ["dagger", "bow", "light"],
    }),
    base("class-apprentice", "Apprentice", "mage", {
      baseStats: {
        maxHp: 75,
        maxMp: 55,
        attack: 7,
        magic: 20,
        defense: 7,
        spirit: 19,
        speed: 10,
      },
      weapon: staff,
      preferredRow: 2,
      proficiencies: ["staff", "focus", "robe"],
    }),
  ];
}
