import {
  meleeClassId,
  withMeleeClasses,
  type Archetype,
  type Character,
  type Gear,
  type Library,
} from "@jforge/char/shared";
import { content, type Stats, type Weapon } from "@jforge/melee/shared";

// The world a run travels through: enemies to meet, travellers to recruit
// and gear to find, on top of whatever was designed in char. Built from
// melee's weapons and skills, like char's starter library. Ids start with
// "world-" so they never collide with a designed library's.

const c = content;

type StatRow = [
  maxHp: number,
  maxMp: number,
  attack: number,
  magic: number,
  defense: number,
  spirit: number,
  speed: number,
];
const stats = ([
  maxHp,
  maxMp,
  attack,
  magic,
  defense,
  spirit,
  speed,
]: StatRow): Stats => ({ maxHp, maxMp, attack, magic, defense, spirit, speed });

function archetype(
  kind: Archetype["kind"],
  id: string,
  name: string,
  portrait: string,
  base: StatRow,
  growth: StatRow,
  weapon: Weapon,
  preferredRow: number,
  skills: [skillId: string, level: number][] = [],
  traits: Archetype["traits"] = [],
): Archetype {
  return {
    id: `world-${id}`,
    name,
    kind,
    portrait,
    baseStats: stats(base),
    growth: stats(growth),
    weapon: { ...weapon, id: `world-${id}-weapon` },
    skills: skills.map(([skillId, level]) => ({ skillId, level })),
    traits,
    preferredRow,
  };
}

const ENEMY_TYPES: Archetype[] = [
  archetype(
    "enemy",
    "wolf",
    "Wolf",
    "wolf",
    [50, 0, 15, 0, 5, 4, 16],
    [5, 0, 1.6, 0, 0.5, 0.4, 0.5],
    c.fangs,
    0,
    [],
    ["beast"],
  ),
  archetype(
    "enemy",
    "slime",
    "Slime",
    "slime",
    [90, 0, 10, 0, 8, 6, 7],
    [10, 0, 1, 0, 1, 0.8, 0.1],
    c.slam,
    0,
    [],
    ["ooze"],
  ),
  archetype(
    "enemy",
    "viper",
    "Viper",
    "viper",
    [38, 0, 11, 0, 3, 4, 17],
    [4, 0, 1.2, 0, 0.3, 0.4, 0.5],
    c.venomFangs,
    0,
    [],
    ["beast", "reptile"],
  ),
  archetype(
    "enemy",
    "bandit",
    "Bandit Archer",
    "archer",
    [48, 12, 13, 0, 5, 5, 13],
    [5, 1, 1.5, 0, 0.5, 0.5, 0.3],
    c.bow,
    2,
    [[c.aimedShot.id, 4]],
  ),
  archetype(
    "enemy",
    "witch",
    "Hedge Witch",
    "mage",
    [42, 30, 4, 13, 4, 9, 11],
    [4, 4, 0.2, 1.6, 0.4, 1, 0.2],
    c.staff,
    2,
    [
      [c.firebolt.id, 1],
      [c.slow.id, 4],
      [c.fireball.id, 7],
    ],
  ),
  archetype(
    "enemy",
    "priest",
    "Bone Priest",
    "healer",
    [50, 35, 5, 11, 5, 11, 10],
    [5, 4, 0.3, 1.3, 0.5, 1.2, 0.2],
    c.staff,
    2,
    [
      [c.heal.id, 1],
      [c.regen.id, 4],
      [c.revive.id, 8],
    ],
    ["undead"],
  ),
  archetype(
    "enemy",
    "golem",
    "Stone Golem",
    "geomancer",
    [130, 0, 17, 0, 14, 6, 6],
    [14, 0, 1.6, 0, 1.4, 0.5, 0.1],
    c.slam,
    0,
    [],
    ["stone"],
  ),
  archetype(
    "enemy",
    "imp",
    "Imp",
    "warlock",
    [36, 20, 9, 12, 4, 7, 15],
    [4, 3, 0.8, 1.4, 0.4, 0.7, 0.4],
    c.claws,
    1,
    [[c.firebolt.id, 2]],
    ["demon"],
  ),
  archetype(
    "enemy",
    "raider",
    "Raider",
    "lancer",
    [70, 8, 15, 0, 9, 5, 11],
    [8, 1, 1.7, 0, 1, 0.5, 0.2],
    c.spear,
    0,
    [[c.skewer.id, 5]],
  ),
];

/** Travellers who can be met; the level they join at is the party's. */
const TRAVELLERS: [name: string, meleeClass: string][] = [
  ["Brann", "archer"],
  ["Isolde", "healer"],
  ["Vex", "rogue"],
  ["Tamsin", "lancer"],
  ["Orrin", "chronomancer"],
  ["Hale", "paladin"],
  ["Wren", "geomancer"],
  ["Cade", "fighter"],
  ["Sable", "warlock"],
  ["Lucan", "mage"],
];

/** Names for travellers of designed classes and when the list runs out. */
export const TRAVELLER_NAMES = [
  "Ansel",
  "Bryn",
  "Corin",
  "Dara",
  "Edda",
  "Finn",
  "Greta",
  "Ilse",
  "Joss",
  "Kell",
  "Lior",
  "Maren",
  "Nico",
  "Oona",
  "Perrin",
  "Quill",
];

const add = (stat: keyof Stats, value: number) => ({
  stat,
  op: "add" as const,
  value,
});
const mul = (stat: keyof Stats, value: number) => ({
  stat,
  op: "mul" as const,
  value,
});
const held = (
  id: string,
  name: string,
  weapon: Weapon,
  bonuses: Gear["bonuses"],
): Gear => ({
  id: `world-${id}`,
  name,
  slot: "weapon",
  bonuses,
  weapon: { ...weapon, id: `world-${id}`, name },
});
const worn = (
  slot: "armor" | "accessory",
  id: string,
  name: string,
  bonuses: Gear["bonuses"],
): Gear => ({
  id: `world-${id}`,
  name,
  slot,
  bonuses,
});

const GEAR: Gear[] = [
  held("blade", "Steel Blade", c.sword, [add("attack", 7)]),
  held("axe", "War Axe", c.sword, [add("attack", 11), mul("speed", 0.9)]),
  held("spear", "Ash Spear", c.spear, [add("attack", 5)]),
  held("daggers", "Twin Daggers", c.daggers, [
    add("attack", 3),
    mul("speed", 1.1),
  ]),
  held("longbow", "Longbow", c.bow, [add("attack", 6)]),
  held("rod", "Ember Rod", c.staff, [add("magic", 7)]),
  held("crook", "Shepherd's Crook", c.staff, [
    add("magic", 3),
    add("spirit", 5),
  ]),
  worn("armor", "plate", "Plate Armor", [
    add("defense", 12),
    mul("speed", 0.85),
  ]),
  worn("armor", "jerkin", "Leather Jerkin", [
    add("defense", 4),
    add("maxHp", 10),
  ]),
  worn("armor", "cloak", "Warded Cloak", [add("spirit", 9)]),
  worn("armor", "vestments", "Vestments", [add("maxMp", 20), add("spirit", 3)]),
  worn("accessory", "amulet", "Amulet of Vigor", [add("maxHp", 25)]),
  worn("accessory", "band", "Power Band", [add("attack", 4)]),
  worn("accessory", "charm", "Sage's Charm", [
    add("magic", 4),
    add("maxMp", 10),
  ]),
  worn("accessory", "buckler", "Iron Buckler", [add("defense", 5)]),
  worn("accessory", "boots", "Fleet Boots", [
    mul("speed", 1.2),
    add("defense", -2),
  ]),
];

/** Plain gear: nothing it makes worse. */
const BASIC = GEAR.filter((g) =>
  g.bonuses.every((b) => (b.op === "add" ? b.value > 0 : b.value >= 1)),
);

const sameWeapon = (a: Weapon, b: Weapon) =>
  a.kind === b.kind &&
  a.damageType === b.damageType &&
  a.columns === b.columns &&
  a.depth === b.depth;

/** How much `gear` adds to what `type` is good at: its best stats count most. */
const suits = (gear: Gear, type: Archetype) =>
  gear.bonuses.reduce(
    (sum, b) =>
      b.op === "add" &&
      ["attack", "magic", "spirit", "defense"].includes(b.stat)
        ? sum + b.value * type.baseStats[b.stat]
        : sum,
    0,
  );

const best = (choices: Gear[], type: Archetype) =>
  choices.reduce<Gear | undefined>(
    (top, g) => (!top || suits(g, type) > suits(top, type) ? g : top),
    undefined,
  );

/**
 * What a recruit brings along: plain world gear in their empty slots.
 * Armor for everyone (vestments for casters, a jerkin otherwise), a
 * weapon if one handles like their own, else an accessory that suits them.
 */
export function withKit(library: Library, character: Character): Character {
  const type = library.archetypes.find((a) => a.id === character.archetypeId);
  if (!type) return character;
  const known = new Set(library.gear.map((g) => g.id));
  const basic = BASIC.filter((g) => known.has(g.id));
  const caster = type.baseStats.magic > type.baseStats.attack;
  const armor = basic.find(
    (g) => g.id === (caster ? "world-vestments" : "world-jerkin"),
  );
  const weapon = best(
    basic.filter((g) => g.weapon && sameWeapon(g.weapon, type.weapon)),
    type,
  );
  const accessory = weapon
    ? undefined
    : best(
        basic.filter((g) => g.slot === "accessory"),
        type,
      );
  const gear = { ...character.gear };
  for (const piece of [weapon, armor, accessory]) {
    if (piece && gear[piece.slot] === undefined) gear[piece.slot] = piece.id;
  }
  return { ...character, gear };
}

const WORLD_SKILLS = [
  c.aimedShot,
  c.firebolt,
  c.fireball,
  c.slow,
  c.haste,
  c.quicken,
  c.heal,
  c.regen,
  c.cure,
  c.revive,
  c.skewer,
  c.shadowstep,
  c.vanish,
  c.aegis,
];

/** Better finds deeper in: each tier adds half again to what gear adds. */
export const GEAR_TIERS = ["", "Fine", "Superior", "Masterwork"] as const;
export const tierId = (id: string, tier: number) =>
  tier > 0 ? `${id}+${tier}` : id;

/** `gear` at a tier: its additions grow, its multipliers stay. */
export function atTier(gear: Gear, tier: number): Gear {
  if (tier <= 0) return gear;
  const name = `${GEAR_TIERS[tier]} ${gear.name}`;
  return {
    ...gear,
    id: tierId(gear.id, tier),
    name,
    bonuses: gear.bonuses.map((b) =>
      b.op === "add" && b.value > 0
        ? { ...b, value: Math.round(b.value * (1 + tier / 2)) }
        : b,
    ),
    ...(gear.weapon
      ? { weapon: { ...gear.weapon, id: tierId(gear.id, tier), name } }
      : {}),
  };
}

const enemy = (type: Archetype, level: number): Character => ({
  id: `${type.id}-1`,
  name: type.name,
  archetypeId: type.id,
  level,
  xp: 0,
  gear: {},
});

/**
 * The library a run plays with: `library` plus the world's enemies (at
 * `level`), melee's classes, travellers and gear, and every piece of gear at every
 * tier. What was designed comes first, so it sets out and shows up first.
 */
export function withWorld(designed: Library, level: number): Library {
  const library = withMeleeClasses(designed);
  const have = new Set(library.skills.map((s) => s.id));
  const gear = [...library.gear, ...GEAR];
  return {
    ...library,
    skills: [
      ...library.skills,
      ...WORLD_SKILLS.filter((s) => !have.has(s.id)).map((s) =>
        structuredClone(s),
      ),
    ],
    gear: GEAR_TIERS.flatMap((_, tier) => gear.map((g) => atTier(g, tier))),
    archetypes: [...library.archetypes, ...ENEMY_TYPES],
    characters: [
      ...library.characters,
      ...TRAVELLERS.map(([name, type], i): Character => ({
        id: `world-traveller-${i + 1}`,
        name,
        archetypeId: meleeClassId(type),
        level: 1,
        xp: 0,
        gear: {},
      })),
      ...ENEMY_TYPES.map((type) => enemy(type, Math.max(1, level - 1))),
    ],
  };
}
