import type {
  Archetype,
  Character,
  Gear,
  GearCategory,
  Library,
} from "@jforge/rules/core";
import { content, type Stats, type Weapon } from "@jforge/melee/shared";

// The world's content: enemy types to meet and gear to find, built from
// melee's weapons and skills, and the melee skills those enemies use. jrpg
// picks the enemies (@jforge/content/jrpg). Ids start with "world-".

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
  weapon: Weapon,
  preferredRow: number,
  skills: string[] = [],
  traits: Archetype["traits"] = [],
): Archetype {
  return {
    id: `world-${id}`,
    name,
    kind,
    portrait,
    baseStats: stats(base),
    weapon: { ...weapon, id: `world-${id}-weapon` },
    skills,
    traits,
    preferredRow,
  };
}

export const WORLD_ENEMIES: Archetype[] = [
  archetype(
    "enemy",
    "wolf",
    "Wolf",
    "wolf",
    [50, 0, 15, 0, 5, 4, 16],
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
    [48, 12, 13, 0, 5, 5, 12],
    c.bow,
    2,
    [c.aimedShot.id],
  ),
  archetype(
    "enemy",
    "witch",
    "Hedge Witch",
    "mage",
    [42, 30, 4, 13, 4, 9, 11],
    c.staff,
    2,
    [c.firebolt.id, c.slow.id, c.fireball.id],
  ),
  archetype(
    "enemy",
    "priest",
    "Bone Priest",
    "healer",
    [50, 35, 5, 11, 5, 11, 10],
    c.staff,
    2,
    [c.heal.id, c.regen.id, c.revive.id],
    ["undead"],
  ),
  archetype(
    "enemy",
    "golem",
    "Stone Golem",
    "geomancer",
    [130, 0, 17, 0, 14, 6, 6],
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
    c.claws,
    1,
    [c.firebolt.id],
    ["demon"],
  ),
  archetype(
    "enemy",
    "raider",
    "Raider",
    "lancer",
    [70, 8, 15, 0, 9, 5, 11],
    c.spear,
    0,
    [c.skewer.id],
  ),
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
  category: GearCategory,
  weapon: Weapon,
  bonuses: Gear["bonuses"],
): Gear => ({
  id: `world-${id}`,
  name,
  slot: "weapon",
  category,
  bonuses,
  weapon: { ...weapon, id: `world-${id}`, name },
});
const worn = (
  category: GearCategory,
  id: string,
  name: string,
  bonuses: Gear["bonuses"],
): Gear => ({
  id: `world-${id}`,
  name,
  slot: "armor",
  category,
  bonuses,
});
const accessory = (
  id: string,
  name: string,
  bonuses: Gear["bonuses"],
): Gear => ({
  id: `world-${id}`,
  name,
  slot: "accessory",
  bonuses,
});

export const WORLD_GEAR: Gear[] = [
  held("blade", "Steel Blade", "blade", c.sword, [add("attack", 7)]),
  held("axe", "War Axe", "blade", c.sword, [
    add("attack", 11),
    mul("speed", 0.9),
  ]),
  held("spear", "Ash Spear", "polearm", c.spear, [add("attack", 5)]),
  held("daggers", "Twin Daggers", "dagger", c.daggers, [
    add("attack", 3),
    mul("speed", 1.1),
  ]),
  held("longbow", "Longbow", "bow", c.bow, [add("attack", 6)]),
  held("rod", "Ember Rod", "staff", c.staff, [add("magic", 7)]),
  held("orb", "Seer's Orb", "focus", c.hourglass, [
    add("magic", 5),
    add("maxMp", 10),
  ]),
  held("tome", "Black Tome", "focus", c.grimoire, [
    add("magic", 9),
    add("spirit", -3),
  ]),
  held("crook", "Shepherd's Crook", "staff", c.staff, [
    add("magic", 3),
    add("spirit", 5),
  ]),
  worn("heavy", "plate", "Plate Armor", [
    add("defense", 12),
    mul("speed", 0.85),
  ]),
  worn("heavy", "scale", "Scale Mail", [
    add("defense", 7),
    add("maxHp", 15),
    mul("speed", 0.95),
  ]),
  worn("light", "coat", "Ranger's Coat", [
    add("defense", 3),
    mul("speed", 1.05),
  ]),
  worn("light", "jerkin", "Leather Jerkin", [
    add("defense", 4),
    add("maxHp", 10),
  ]),
  worn("robe", "cloak", "Warded Cloak", [add("spirit", 9)]),
  worn("robe", "vestments", "Vestments", [add("maxMp", 20), add("spirit", 3)]),
  accessory("amulet", "Amulet of Vigor", [add("maxHp", 25)]),
  accessory("band", "Power Band", [add("attack", 4)]),
  accessory("charm", "Sage's Charm", [add("magic", 4), add("maxMp", 10)]),
  accessory("buckler", "Iron Buckler", [add("defense", 5)]),
  accessory("boots", "Fleet Boots", [mul("speed", 1.2), add("defense", -2)]),
];

export const WORLD_SKILLS = [
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

const enemy = (type: Archetype): Character => ({
  id: `${type.id}-1`,
  name: type.name,
  archetypeId: type.id,
  gear: {},
});

/** The world's enemy type ids, in order. */
export const WORLD_ENEMY_IDS: string[] = WORLD_ENEMIES.map((a) => a.id);

/**
 * `library` with the world's content after its own: the skills it lacks,
 * the gear, the enemy types and one character of each.
 */
export function withWorldContent(library: Library): Library {
  const have = new Set(library.skills.map((s) => s.id));
  return {
    ...library,
    skills: [
      ...library.skills,
      ...WORLD_SKILLS.filter((s) => !have.has(s.id)).map((s) =>
        structuredClone(s),
      ),
    ],
    gear: [...library.gear, ...WORLD_GEAR],
    archetypes: [...library.archetypes, ...WORLD_ENEMIES],
    characters: [...library.characters, ...WORLD_ENEMIES.map(enemy)],
  };
}
