import type { BattleSetup, CombatantDef, Skill, Weapon } from "./types";

// Starter content so melee can set up a fight on its own. The four player
// types become class templates in char later. Everyone uses a basic attack
// until skills arrive; their weapon decides whom they can reach.

/** Normal melee: own column and both neighbours, front-most unit only. */
export const sword: Weapon = {
  id: "sword",
  name: "Sword",
  columns: 1,
  depth: 1,
  damageType: "slash",
  kind: "melee",
};
/** Longer melee: like a sword, but also reaches the unit behind. */
export const spear: Weapon = {
  id: "spear",
  name: "Spear",
  columns: 1,
  depth: 2,
  damageType: "pierce",
  kind: "melee",
};
/** Any column, but cannot shoot past the front-most unit. */
export const bow: Weapon = {
  id: "bow",
  name: "Bow",
  columns: "any",
  depth: 1,
  damageType: "pierce",
  kind: "ranged",
};
/** Magic ignores cover: any enemy. */
export const staff: Weapon = {
  id: "staff",
  name: "Staff",
  columns: "any",
  depth: "any",
  damageType: "crush",
  kind: "ranged",
};
/** Natural melee weapons of monsters. */
export const slam: Weapon = {
  id: "slam",
  name: "Slam",
  columns: 1,
  depth: 1,
  damageType: "crush",
  kind: "melee",
};
export const fangs: Weapon = {
  id: "fangs",
  name: "Fangs",
  columns: 1,
  depth: 1,
  damageType: "pierce",
  kind: "melee",
};

/** A bite that leaves venom: poisons whoever it wounds. */
export const venomFangs: Weapon = {
  id: "venom-fangs",
  name: "Venom Fangs",
  columns: 1,
  depth: 1,
  damageType: "pierce",
  kind: "melee",
  onHit: {
    id: "poison",
    name: "Poison",
    effect: "damage",
    harmful: true,
    damageType: "poison",
    stat: "attack",
    power: 0.4,
    interval: 30,
    ticks: 5,
  },
};

/** A weak ranged poke: any column, front-most unit only. */
export const hourglass: Weapon = {
  id: "hourglass",
  name: "Hourglass",
  columns: "any",
  depth: 1,
  damageType: "crush",
  kind: "ranged",
};

/** Warlock: shadow bolts from a spellbook; any column, front-most only. */
export const grimoire: Weapon = {
  id: "grimoire",
  name: "Grimoire",
  columns: "any",
  depth: 1,
  damageType: "shadow",
  kind: "ranged",
};

/** Imp: small melee claws. */
export const claws: Weapon = {
  id: "claws",
  name: "Claws",
  columns: 1,
  depth: 1,
  damageType: "slash",
  kind: "melee",
};

/** Rogue: quick melee blades. */
export const daggers: Weapon = {
  id: "daggers",
  name: "Daggers",
  columns: 1,
  depth: 1,
  damageType: "pierce",
  kind: "melee",
};

/** Paladin: a sword that deals holy damage. */
export const blessedBlade: Weapon = {
  id: "blessed-blade",
  name: "Blessed Blade",
  columns: 1,
  depth: 1,
  damageType: "holy",
  kind: "melee",
};

/** Geomancer: hurled stones (crush); any column, front-most unit only. */
export const rod: Weapon = {
  id: "rod",
  name: "Rod",
  columns: "any",
  depth: 1,
  damageType: "crush",
  kind: "ranged",
};

/** For obstacles, which never attack. */
export const noWeapon: Weapon = {
  id: "none",
  name: "None",
  columns: 0,
  depth: 1,
  damageType: "crush",
  kind: "melee",
};

export const weapons = [
  sword,
  spear,
  bow,
  staff,
  slam,
  fangs,
  venomFangs,
  hourglass,
  grimoire,
  claws,
  daggers,
  blessedBlade,
  rod,
];

export const heal: Skill = {
  id: "heal",
  name: "Heal",
  description: "Restores HP to one ally.",
  mpCost: 8,
  target: "ally",
  area: "single",
  effect: { type: "heal", power: 1.6 },
};

/**
 * Hits the aimed cell and the four next to it, on either side. Aimed at the
 * enemy front row, the blast crosses the line onto your own front row.
 */
export const fireball: Skill = {
  id: "fireball",
  name: "Fireball",
  description: "Burns a plus-shaped area. Mind your own front line.",
  mpCost: 12,
  target: "any",
  area: "plus",
  effect: { type: "damage", kind: "magical", element: "fire", power: 1.2 },
};

/**
 * Fireball's big brother: a 3x3 blast that lands after a delay. Everyone in
 * the zone at impact is hit, so allies can step out while it falls.
 */
export const meteor: Skill = {
  id: "meteor",
  name: "Meteor",
  description: "After a delay, crushes a 3x3 area. Clear the zone in time.",
  mpCost: 24,
  target: "any",
  area: "square",
  effect: { type: "damage", kind: "magical", element: "fire", power: 2 },
  castTime: 60,
};

/**
 * Heals a little at a time: more in total than Heal, but slow. Best cast on
 * the front line before the damage piles up.
 */
export const regen: Skill = {
  id: "regen",
  name: "Regen",
  description: "Heals one ally a little every few moments for a while.",
  mpCost: 10,
  target: "ally",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "regen",
      name: "Regen",
      effect: "heal",
      harmful: false,
      stat: "magic",
      power: 0.4,
      interval: 30,
      ticks: 5,
    },
  },
};

/** Removes poison and other harmful effects; leaves Regen alone. */
export const cure: Skill = {
  id: "cure",
  name: "Cure",
  description: "Removes harmful effects such as poison from one ally.",
  mpCost: 5,
  target: "ally",
  area: "single",
  effect: { type: "cleanse" },
};

/** Lancer: thrusts through the target into the unit right behind it. */
export const skewer: Skill = {
  id: "skewer",
  name: "Skewer",
  description: "Spear thrust through the target and the unit behind it.",
  mpCost: 4,
  target: "enemy",
  area: "line",
  effect: { type: "strike", power: 0.9 },
};

/** Fighter: one wide swing through every enemy the sword can reach. */
export const cleave: Skill = {
  id: "cleave",
  name: "Cleave",
  description: "A wide swing that strikes every enemy within reach.",
  mpCost: 5,
  target: "enemy",
  area: "reach",
  effect: { type: "strike", power: 0.7 },
};

/** Lancer: drags an enemy one row forward, out of cover. */
export const hook: Skill = {
  id: "hook",
  name: "Hook",
  description:
    "Pulls an enemy one row forward. If something is in the way, it crashes into it.",
  mpCost: 4,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 0.6, push: -1 },
};

/** Chronomancer: an ally's gauge fills 50% faster for a while. */
export const haste: Skill = {
  id: "haste",
  name: "Haste",
  description: "One ally acts more often for a while (speed x1.5).",
  mpCost: 8,
  target: "ally",
  area: "single",
  effect: {
    type: "modify",
    modifier: {
      name: "Haste",
      stat: "speed",
      op: "mul",
      value: 1.5,
      duration: 150,
      harmful: false,
    },
  },
};

/** Chronomancer: an enemy's gauge fills at half speed for a while. */
export const slow: Skill = {
  id: "slow",
  name: "Slow",
  description: "One enemy acts less often for a while (speed x0.5).",
  mpCost: 8,
  target: "enemy",
  area: "single",
  effect: {
    type: "modify",
    modifier: {
      name: "Slow",
      stat: "speed",
      op: "mul",
      value: 0.5,
      duration: 150,
      harmful: true,
    },
  },
};

/** Chronomancer: fills another ally's gauge, so it acts right away. */
export const quicken: Skill = {
  id: "quicken",
  name: "Quicken",
  description: "Another ally acts right away.",
  mpCost: 12,
  target: "ally",
  area: "single",
  notSelf: true,
  effect: { type: "gauge", to: 1 },
};

/** Warlock: shadow damage that heals the Warlock by half of it. */
export const drain: Skill = {
  id: "drain",
  name: "Drain",
  description:
    "Shadow damage to one enemy; heals you by half the damage dealt.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  effect: {
    type: "damage",
    kind: "magical",
    element: "shadow",
    power: 1,
    drain: 0.5,
  },
};

/** Warlock: a heavy shadow bolt paid for with the Warlock's own HP. */
export const bloodBolt: Skill = {
  id: "blood-bolt",
  name: "Blood Bolt",
  description: "Heavy shadow damage to one enemy, paid for with 15 of your HP.",
  mpCost: 0,
  hpCost: 15,
  target: "enemy",
  area: "single",
  effect: { type: "damage", kind: "magical", element: "shadow", power: 2 },
};

/** Imp: a small ranged fire spell. */
export const firebolt: Skill = {
  id: "firebolt",
  name: "Firebolt",
  description: "Fire damage to one enemy, anywhere.",
  mpCost: 4,
  target: "enemy",
  area: "single",
  effect: { type: "damage", kind: "magical", element: "fire", power: 1 },
};

/** Summoned by the Warlock; controlled by the player like a party member. */
export const imp: CombatantDef = {
  id: "imp",
  name: "Imp",
  stats: {
    maxHp: 30,
    maxMp: 12,
    attack: 12,
    magic: 12,
    defense: 6,
    spirit: 8,
    speed: 14,
  },
  weapon: claws,
  skills: [firebolt],
  traits: ["demon"],
};

/** Warlock: summons an Imp into an empty cell; replaces the old one. */
export const summonImp: Skill = {
  id: "summon-imp",
  name: "Summon Imp",
  description:
    "Summons an Imp you control into an empty cell on your side. Replaces your current Imp.",
  mpCost: 6,
  hpCost: 10,
  target: "any",
  area: "single",
  effect: { type: "summon", creature: imp },
};

/**
 * Rogue: hides. Enemies can't single it out; its next damaging action is
 * an ambush for x2 and ends the stealth.
 */
export const vanish: Skill = {
  id: "vanish",
  name: "Vanish",
  description:
    "Hide for a while: enemies can't single you out, and your next attack ambushes for double damage.",
  mpCost: 6,
  target: "self",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "stealth",
      name: "Stealth",
      effect: "stealth",
      harmful: false,
      stat: "magic",
      power: 0,
      interval: 150,
      ticks: 1,
    },
  },
};

/** Rogue: steps to any empty cell on its side, for half a turn. */
export const shadowstep: Skill = {
  id: "shadowstep",
  name: "Shadowstep",
  description:
    "Move to any empty cell on your side. Costs half a turn and keeps you hidden.",
  mpCost: 4,
  target: "any",
  area: "single",
  halfTurn: true,
  effect: { type: "teleport" },
};

/** Paladin: a shield that absorbs damage before HP. */
export const aegis: Skill = {
  id: "aegis",
  name: "Aegis",
  description:
    "Shields one ally: absorbs damage (2 x your magic) before HP, for a while.",
  mpCost: 8,
  target: "ally",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "aegis",
      name: "Aegis",
      effect: "shield",
      harmful: false,
      stat: "magic",
      power: 2,
      interval: 150,
      ticks: 1,
    },
  },
};

/** Paladin: for a while, the ally can't be knocked out. */
export const lastRites: Skill = {
  id: "last-rites",
  name: "Last Rites",
  description:
    "For a while, one ally can't be knocked out: a lethal blow leaves 1 HP.",
  mpCost: 12,
  target: "ally",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "last-rites",
      name: "Last Rites",
      effect: "ward",
      harmful: false,
      stat: "magic",
      power: 0,
      interval: 120,
      ticks: 1,
    },
  },
};

/**
 * Raised by the Geomancer: takes up a cell, gives cover, can be attacked,
 * never acts. Vanishes (no rubble) when destroyed.
 */
export const boulder: CombatantDef = {
  id: "boulder",
  name: "Boulder",
  stats: {
    maxHp: 40,
    maxMp: 0,
    attack: 0,
    magic: 0,
    defense: 60,
    spirit: 60,
    speed: 0,
  },
  weapon: noWeapon,
  traits: ["stone"],
  obstacle: true,
};

/** Geomancer: a boulder in any empty cell, on either side. Two at most. */
export const raiseBoulder: Skill = {
  id: "raise-boulder",
  name: "Raise Boulder",
  description:
    "Raises a boulder in an empty cell on either side: it blocks the cell and gives cover. Two at most; a third replaces the oldest.",
  mpCost: 6,
  target: "any",
  area: "single",
  effect: { type: "summon", creature: boulder, limit: 2, anySide: true },
};

/** Geomancer: blows up one of its boulders; everyone around it is hit. */
export const shatter: Skill = {
  id: "shatter",
  name: "Shatter",
  description:
    "Destroys one of your boulders: impact damage to every unit around it, friend or foe.",
  mpCost: 8,
  target: "any",
  area: "plus",
  effect: { type: "shatter", power: 1.2, element: "impact" },
};

/** Geomancer: heaves any unit (or boulder) one row back. */
export const upheaval: Skill = {
  id: "upheaval",
  name: "Upheaval",
  description:
    "The ground heaves one unit (ally, enemy or boulder) one row back. Nothing happens if the way is blocked.",
  mpCost: 6,
  target: "any",
  area: "single",
  effect: { type: "heave", rows: 1 },
};

export const skills = [
  heal,
  fireball,
  meteor,
  regen,
  cure,
  cleave,
  skewer,
  hook,
  haste,
  slow,
  quicken,
  drain,
  bloodBolt,
  firebolt,
  summonImp,
  vanish,
  shadowstep,
  aegis,
  lastRites,
  raiseBoulder,
  shatter,
  upheaval,
];

export const fighter: CombatantDef = {
  id: "fighter",
  name: "Fighter",
  stats: {
    maxHp: 120,
    maxMp: 10,
    attack: 22,
    magic: 4,
    defense: 18,
    spirit: 8,
    speed: 10,
  },
  weapon: sword,
  skills: [cleave],
  preferredRow: 0,
};

export const archer: CombatantDef = {
  id: "archer",
  name: "Archer",
  stats: {
    maxHp: 90,
    maxMp: 20,
    attack: 18,
    magic: 6,
    defense: 10,
    spirit: 10,
    speed: 13,
  },
  weapon: bow,
  preferredRow: 1,
};

export const mage: CombatantDef = {
  id: "mage",
  name: "Mage",
  stats: {
    maxHp: 70,
    maxMp: 60,
    attack: 6,
    magic: 24,
    defense: 6,
    spirit: 18,
    speed: 9,
  },
  weapon: staff,
  skills: [fireball, meteor],
  preferredRow: 2,
};

export const healer: CombatantDef = {
  id: "healer",
  name: "Healer",
  stats: {
    maxHp: 80,
    maxMp: 50,
    attack: 8,
    magic: 16,
    defense: 8,
    spirit: 20,
    speed: 11,
  },
  weapon: staff,
  skills: [heal, regen, cure],
  preferredRow: 2,
};

export const slime: CombatantDef = {
  id: "slime",
  name: "Slime",
  stats: {
    maxHp: 60,
    maxMp: 0,
    attack: 12,
    magic: 0,
    defense: 6,
    spirit: 4,
    speed: 7,
  },
  weapon: slam,
  // Clumsy: mostly flails at whatever is in reach.
  targeting: { finish: 1, wounded: 0.5, soft: 0.5, noise: 2 },
  threat: 2,
  // An ooze: melts in fire, shrugs off crushing and piercing, no poison.
  traits: ["ooze"],
};

export const wolf: CombatantDef = {
  id: "wolf",
  name: "Wolf",
  stats: {
    maxHp: 50,
    maxMp: 0,
    attack: 16,
    magic: 0,
    defense: 6,
    spirit: 4,
    speed: 15,
  },
  weapon: fangs,
  // A finisher: goes for the wounded and the kill.
  targeting: { finish: 5, wounded: 3, soft: 1, noise: 0.3 },
  threat: 3,
  // A beast: arrows and spears find its flanks.
  traits: ["beast"],
};

/**
 * Spear fighter: reaches the front-most unit and the one behind it. Pulls
 * enemies out of cover and punishes stacked columns.
 */
export const lancer: CombatantDef = {
  id: "lancer",
  name: "Lancer",
  stats: {
    maxHp: 105,
    maxMp: 16,
    attack: 20,
    magic: 4,
    defense: 14,
    spirit: 8,
    speed: 11,
  },
  weapon: spear,
  skills: [skewer, hook],
  preferredRow: 0,
};

/**
 * Controls time instead of dealing damage: speeds allies up, slows enemies
 * down, and can give an ally its turn right now.
 */
export const chronomancer: CombatantDef = {
  id: "chronomancer",
  name: "Chronomancer",
  stats: {
    maxHp: 75,
    maxMp: 50,
    attack: 8,
    magic: 18,
    defense: 8,
    spirit: 18,
    speed: 12,
  },
  weapon: hourglass,
  skills: [haste, slow, quicken],
  preferredRow: 2,
};

/**
 * Dark caster that spends its own HP: Blood Bolt costs HP, Drain wins it
 * back, and it can summon an Imp to fight alongside the party.
 */
export const warlock: CombatantDef = {
  id: "warlock",
  name: "Warlock",
  stats: {
    maxHp: 85,
    maxMp: 36,
    attack: 8,
    magic: 20,
    defense: 9,
    spirit: 14,
    speed: 10,
  },
  weapon: grimoire,
  skills: [drain, bloodBolt, summonImp],
  preferredRow: 2,
};

/**
 * Fast and fragile: hides with Vanish, slips anywhere with Shadowstep, and
 * ambushes from stealth for double damage.
 */
export const rogue: CombatantDef = {
  id: "rogue",
  name: "Rogue",
  stats: {
    maxHp: 80,
    maxMp: 20,
    attack: 19,
    magic: 4,
    defense: 9,
    spirit: 9,
    speed: 15,
  },
  weapon: daggers,
  skills: [vanish, shadowstep],
  preferredRow: 1,
};

/**
 * Holy warrior: fights in front with a holy blade and protects allies
 * before harm lands, with shields (Aegis) and a ward against knockouts
 * (Last Rites).
 */
export const paladin: CombatantDef = {
  id: "paladin",
  name: "Paladin",
  stats: {
    maxHp: 115,
    maxMp: 24,
    attack: 18,
    magic: 14,
    defense: 20,
    spirit: 16,
    speed: 9,
  },
  weapon: blessedBlade,
  skills: [aegis, lastRites],
  preferredRow: 0,
};

/**
 * Shapes the battlefield: raises boulders for cover and blocking, shatters
 * them on crowds, and heaves units (or boulders) back a row.
 */
export const geomancer: CombatantDef = {
  id: "geomancer",
  name: "Geomancer",
  stats: {
    maxHp: 95,
    maxMp: 34,
    attack: 10,
    magic: 17,
    defense: 12,
    spirit: 14,
    speed: 10,
  },
  weapon: rod,
  skills: [raiseBoulder, shatter, upheaval],
  preferredRow: 1,
};

export const playerTypes = [
  fighter,
  lancer,
  archer,
  mage,
  healer,
  chronomancer,
  warlock,
  rogue,
  paladin,
  geomancer,
];
/** Fast and frail; its bite poisons. Likes soft targets. */
export const viper: CombatantDef = {
  id: "viper",
  name: "Viper",
  stats: {
    maxHp: 40,
    maxMp: 0,
    attack: 10,
    magic: 0,
    defense: 4,
    spirit: 6,
    speed: 13,
  },
  weapon: venomFangs,
  targeting: { finish: 2, wounded: 1, soft: 2, noise: 0.5 },
  // Beast and reptile (weak to pierce and cold); immune to its own venom.
  traits: ["beast", "reptile"],
  resistances: { poison: 0 },
  threat: 2,
};

export const monsters = [slime, wolf, viper];

/** The four player types against a small mixed pack. */
export const sampleBattle: BattleSetup = {
  placements: [
    { def: fighter, side: "player", position: { col: 1, row: 0 } },
    { def: archer, side: "player", position: { col: 3, row: 1 } },
    { def: mage, side: "player", position: { col: 1, row: 2 } },
    { def: healer, side: "player", position: { col: 3, row: 2 } },
    { def: slime, side: "enemy", position: { col: 1, row: 0 } },
    { def: slime, side: "enemy", position: { col: 3, row: 0 } },
    { def: wolf, side: "enemy", position: { col: 2, row: 1 } },
  ],
};
