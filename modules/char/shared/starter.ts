import { SAVE_VERSION, content } from "@jforge/melee/shared";
import { withMeleeClasses } from "./melee";
import { GAMES, type Archetype, type Library } from "./types";

const {
  bow,
  cleave,
  daggers,
  fireball,
  firebolt,
  grimoire,
  heal,
  rod,
  spear,
  staff,
  sword,
  tome,
} = content;

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
      ...secondClasses(),
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
    rest: ClassShape,
  ): Archetype => skillless(id, name, portrait, rest);
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

/** What sets a skill-less starter class apart from another. */
type ClassShape = Pick<
  Archetype,
  "baseStats" | "weapon" | "preferredRow" | "proficiencies"
> & { comesFrom?: string[] };

/** A class with no skills or traits that no game uses yet. */
function skillless(
  id: string,
  name: string,
  portrait: string,
  shape: ClassShape,
): Archetype {
  return {
    id,
    name,
    kind: "class",
    portrait,
    skills: [],
    traits: [],
    games: [],
    ...shape,
    weapon: { ...structuredClone(shape.weapon), id: `${id}-weapon` },
  };
}

/** A starter weapon under another name. */
const renamed = (weapon: Archetype["weapon"], name: string) => ({
  ...weapon,
  name,
});

/**
 * The class graph's second level (see docs/progression.md, section 6):
 * one class per broad role, each coming from its base. Like the bases they
 * have no skills yet and no game uses them yet.
 */
function secondClasses(): Archetype[] {
  const from =
    (base: string) =>
    (id: string, name: string, portrait: string, shape: ClassShape) =>
      skillless(id, name, portrait, { ...shape, comesFrom: [base] });
  const squire = from("class-squire");
  const scout = from("class-scout");
  const apprentice = from("class-apprentice");
  return [
    // Squire: the front line.
    squire("class-guardian", "Guardian", "knight", {
      baseStats: {
        maxHp: 130,
        maxMp: 14,
        attack: 16,
        magic: 4,
        defense: 24,
        spirit: 12,
        speed: 8,
      },
      weapon: sword,
      preferredRow: 0,
      proficiencies: ["blade", "polearm", "heavy"],
    }),
    squire("class-warrior", "Warrior", "fighter", {
      baseStats: {
        maxHp: 115,
        maxMp: 10,
        attack: 26,
        magic: 4,
        defense: 14,
        spirit: 8,
        speed: 10,
      },
      weapon: renamed(sword, "Greatsword"),
      preferredRow: 0,
      proficiencies: ["blade", "polearm", "heavy", "light"],
    }),
    squire("class-spearman", "Spearman", "lancer", {
      baseStats: {
        maxHp: 105,
        maxMp: 16,
        attack: 20,
        magic: 4,
        defense: 14,
        spirit: 8,
        speed: 11,
      },
      weapon: spear,
      preferredRow: 0,
      proficiencies: ["polearm", "heavy", "light"],
    }),
    // Scout: speed and reach.
    scout("class-thief", "Thief", "rogue", {
      baseStats: {
        maxHp: 78,
        maxMp: 20,
        attack: 18,
        magic: 4,
        defense: 8,
        spirit: 9,
        speed: 17,
      },
      weapon: daggers,
      preferredRow: 1,
      proficiencies: ["dagger", "light"],
    }),
    scout("class-archer", "Archer", "archer", {
      baseStats: {
        maxHp: 88,
        maxMp: 20,
        attack: 19,
        magic: 6,
        defense: 9,
        spirit: 10,
        speed: 12,
      },
      weapon: bow,
      preferredRow: 2,
      proficiencies: ["bow", "light"],
    }),
    scout("class-duelist", "Duelist", "rogue", {
      baseStats: {
        maxHp: 90,
        maxMp: 16,
        attack: 21,
        magic: 4,
        defense: 11,
        spirit: 8,
        speed: 16,
      },
      weapon: renamed(sword, "Rapier"),
      preferredRow: 0,
      proficiencies: ["blade", "dagger", "light"],
    }),
    scout("class-beastmaster", "Beastmaster", "wolf", {
      baseStats: {
        maxHp: 92,
        maxMp: 24,
        attack: 16,
        magic: 8,
        defense: 11,
        spirit: 12,
        speed: 12,
      },
      weapon: daggers,
      preferredRow: 1,
      proficiencies: ["dagger", "bow", "light"],
    }),
    // Apprentice: magic, to hurt, heal, bend or call.
    apprentice("class-mage", "Mage", "mage", {
      baseStats: {
        maxHp: 70,
        maxMp: 60,
        attack: 6,
        magic: 25,
        defense: 6,
        spirit: 18,
        speed: 9,
      },
      weapon: staff,
      preferredRow: 2,
      proficiencies: ["staff", "focus", "robe"],
    }),
    apprentice("class-cleric", "Cleric", "healer", {
      baseStats: {
        maxHp: 82,
        maxMp: 50,
        attack: 8,
        magic: 15,
        defense: 9,
        spirit: 21,
        speed: 10,
      },
      weapon: rod,
      preferredRow: 2,
      proficiencies: ["staff", "focus", "robe", "light"],
    }),
    apprentice("class-enchanter", "Enchanter", "sage", {
      baseStats: {
        maxHp: 75,
        maxMp: 55,
        attack: 7,
        magic: 17,
        defense: 8,
        spirit: 19,
        speed: 12,
      },
      weapon: tome,
      preferredRow: 2,
      proficiencies: ["staff", "focus", "robe"],
    }),
    apprentice("class-summoner", "Summoner", "warlock", {
      baseStats: {
        maxHp: 78,
        maxMp: 50,
        attack: 6,
        magic: 20,
        defense: 7,
        spirit: 16,
        speed: 10,
      },
      weapon: grimoire,
      preferredRow: 2,
      proficiencies: ["staff", "focus", "robe"],
    }),
  ];
}
