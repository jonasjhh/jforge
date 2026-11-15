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
  damageType: "blunt",
  kind: "ranged",
};
/** Natural melee weapons of monsters. */
export const slam: Weapon = {
  id: "slam",
  name: "Slam",
  columns: 1,
  depth: 1,
  damageType: "blunt",
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
  damageType: "blunt",
  kind: "ranged",
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

export const skills = [
  heal,
  fireball,
  meteor,
  regen,
  cure,
  skewer,
  hook,
  haste,
  slow,
  quicken,
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
  // Melts in fire; blunt blows just squish it.
  resistances: { fire: 2, blunt: 0.5, poison: 0 },
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
  // Arrows and spears find its flanks.
  resistances: { pierce: 1.5 },
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

export const playerTypes = [
  fighter,
  lancer,
  archer,
  mage,
  healer,
  chronomancer,
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
