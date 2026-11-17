import { POISON } from "./poison";
import type { CombatantDef, Skill, Weapon } from "./types";

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
  // Drawing and nocking takes time: a bow's holder acts after most units
  // at first, however fast it is.
  startGauge: -500,
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
  onHit: POISON,
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

/** Knight: a lance; like a sword, but it pierces. */
export const lance: Weapon = {
  id: "lance",
  name: "Lance",
  columns: 1,
  depth: 1,
  damageType: "pierce",
  kind: "melee",
};

/** Sage: arcane words read from a tome; any column, front-most unit only. */
export const tome: Weapon = {
  id: "tome",
  name: "Tome",
  columns: "any",
  depth: 1,
  damageType: "arcane",
  kind: "ranged",
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
  lance,
  tome,
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

export const revive: Skill = {
  id: "revive",
  name: "Revive",
  description: "Brings a knocked-out ally back with some HP.",
  mpCost: 20,
  target: "ally",
  area: "single",
  effect: { type: "revive", power: 1.5 },
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

/** Healer: a holy bolt, so it has something to do when no one is hurt. */
export const smite: Skill = {
  id: "smite",
  name: "Smite",
  description: "A holy bolt (x1.2) at one enemy.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  effect: { type: "damage", kind: "magical", element: "holy", power: 1.2 },
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

/**
 * Archer: arrows rain down on a 3x3 area. Aimed past the enemy front row
 * it spares your own; aimed at it, it spills onto your front line.
 */
export const volley: Skill = {
  id: "volley",
  name: "Volley",
  description:
    "Arrows rain on a 3x3 area (x0.5 each), over cover. Aimed at the enemy front row, it hits your own front row too.",
  mpCost: 8,
  target: "enemy",
  area: "square",
  notFromFront: true,
  effect: { type: "strike", power: 0.5, ignoreCover: true },
};

/** Archer: a shot that pins its target, which acts less often for a while. */
export const pinningShot: Skill = {
  id: "pinning-shot",
  name: "Pinning Shot",
  description:
    "A shot (x0.7) that pins its target: speed x0.7 for a while if it survives.",
  mpCost: 5,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 0.7, pin: true },
};

/** Archer: a light shot for half a turn, so the Archer acts again soon. */
export const quickShot: Skill = {
  id: "quick-shot",
  name: "Quick Shot",
  description: "A quick shot (x0.6) that costs only half a turn.",
  mpCost: 3,
  target: "enemy",
  area: "single",
  halfTurn: true,
  effect: { type: "strike", power: 0.6 },
};

/** Archer: a burning arrow: pierce on the hit, then fire over time. */
export const fireArrow: Skill = {
  id: "fire-arrow",
  name: "Fire Arrow",
  description:
    "A burning arrow (x0.8) that sets its target alight: fire damage over time if it survives.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 0.8, ignite: true },
};

/** Mage: a bolt of lightning through the target and the unit behind it. */
export const lightningBolt: Skill = {
  id: "lightning-bolt",
  name: "Lightning Bolt",
  description:
    "Lightning (x0.9) through one enemy and the unit right behind it.",
  mpCost: 10,
  target: "enemy",
  area: "line",
  effect: {
    type: "damage",
    kind: "magical",
    element: "lightning",
    power: 0.9,
  },
};

/** Mage: a shard of ice at one enemy, which slows it a little. */
export const frostLance: Skill = {
  id: "frost-lance",
  name: "Frost Lance",
  description:
    "Cold damage (x1.1) to one enemy, which is chilled: speed x0.85 for a short while.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  effect: {
    type: "damage",
    kind: "magical",
    element: "cold",
    power: 1.1,
    chill: true,
  },
};

/** Mage: turns its own life into MP, to keep the big spells coming. */
export const manaTap: Skill = {
  id: "mana-tap",
  name: "Mana Tap",
  description: "Pay 10 HP to regain 15 MP.",
  mpCost: 0,
  hpCost: 10,
  target: "self",
  area: "single",
  effect: { type: "restoreMp", amount: 15 },
};

/** Lancer: a thrust between the plates: half the target's defense counts. */
export const armorPierce: Skill = {
  id: "armor-pierce",
  name: "Armor Pierce",
  description:
    "A thrust (x1.0) between the plates: only half the target's defense counts.",
  mpCost: 5,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 1, armorPierce: 0.5 },
};

/** Lancer: a jarring thrust that knocks the target's next turn back. */
export const staggeringThrust: Skill = {
  id: "staggering-thrust",
  name: "Staggering Thrust",
  description:
    "A jarring thrust (x0.8) that knocks a quarter off the target's turn gauge, unless it is casting.",
  mpCost: 5,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 0.8, stagger: 0.25 },
};

/** Lancer: a strike that leaves its target weakened: it deals less. */
export const weakeningStrike: Skill = {
  id: "weakening-strike",
  name: "Weakening Strike",
  description:
    "A strike (x0.8) that weakens its target: it deals x0.75 damage for a while.",
  mpCost: 5,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 0.8, weaken: true },
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

/**
 * Fighter: for a while, enemies that single out a target must pick the
 * Fighter while they can reach it. Area attacks still go where they like.
 */
export const provoke: Skill = {
  id: "provoke",
  name: "Provoke",
  description:
    "Dares the enemies: for a while, any enemy that can single you out must target you.",
  mpCost: 5,
  target: "self",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "taunt",
      name: "Provoke",
      effect: "taunt",
      harmful: false,
      stat: "attack",
      power: 0,
      interval: 150,
      ticks: 1,
    },
  },
};

/**
 * Archer: a careful shot over the front line at a covered enemy. It takes
 * aim first (castTime) and lands on the aimed cell, so the target can step
 * out of it; x1.5 makes up for the wait. Not from the front row.
 */
export const aimedShot: Skill = {
  id: "aimed-shot",
  name: "Aimed Shot",
  description:
    "Take aim, then a careful shot (x1.5) that finds any visible enemy, even in cover. It lands where the target stood. Not while locked in melee in the front row.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  castTime: 40,
  notFromFront: true,
  effect: { type: "strike", power: 1.5, ignoreCover: true },
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

/**
 * Chronomancer: a bomb on one enemy that goes off when its time runs out,
 * or as soon as the enemy falls, hitting it and its neighbours.
 */
export const timeBomb: Skill = {
  id: "timeBomb",
  name: "Time Bomb",
  description:
    "Plants a bomb on one enemy. It explodes when time runs out or the enemy falls, hitting it and its neighbours.",
  mpCost: 10,
  target: "enemy",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "timeBomb",
      name: "Time Bomb",
      effect: "bomb",
      harmful: true,
      damageType: "arcane",
      stat: "magic",
      power: 1,
      interval: 90,
      ticks: 1,
    },
  },
};

/**
 * Chronomancer: one ally gets back the HP it lost since its last turn
 * ended, however much that was.
 */
export const rewind: Skill = {
  id: "rewind",
  name: "Rewind",
  description: "One ally gets back all the HP it lost since its last turn.",
  mpCost: 10,
  target: "ally",
  area: "single",
  effect: { type: "rewind" },
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

/** Warlock: shadow damage over time on one enemy. */
export const curse: Skill = {
  id: "curse",
  name: "Curse",
  description: "Shadow damage over time on one enemy.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "cursed",
      name: "Cursed",
      effect: "damage",
      harmful: true,
      damageType: "shadow",
      stat: "magic",
      power: 0.3,
      interval: 30,
      ticks: 5,
    },
  },
};

/**
 * Warlock: gives up its Imp, healing by the HP the Imp had left and
 * gaining a strong magic boost for a while.
 */
export const sacrifice: Skill = {
  id: "sacrifice",
  name: "Sacrifice",
  description:
    "Gives up your Imp: you heal by the HP it had left and your magic rises (x1.5) for a while.",
  mpCost: 0,
  target: "ally",
  area: "single",
  notSelf: true,
  effect: {
    type: "sacrifice",
    modifier: {
      name: "Dark Pact",
      stat: "magic",
      op: "mul",
      value: 1.5,
      duration: 150,
      harmful: false,
    },
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

/**
 * Rogue: coats its blade for a long while; every weapon hit (attacks and
 * strike skills) poisons, as the Viper's bite does.
 */
export const poisonBlade: Skill = {
  id: "poisonBlade",
  name: "Poison Blade",
  description:
    "Coat your blade for a long while: every weapon hit poisons its target.",
  mpCost: 5,
  target: "self",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "poisonBlade",
      name: "Poison Blade",
      effect: "coat",
      harmful: false,
      stat: "attack",
      power: 0,
      interval: 450,
      ticks: 1,
    },
  },
};

/**
 * Rogue: hides another ally in smoke. Enemies can't single it out for a
 * while; unlike Stealth, acting doesn't end it and there's no ambush.
 */
export const smokeBomb: Skill = {
  id: "smokeBomb",
  name: "Smoke Bomb",
  description:
    "Hide another ally in smoke: enemies can't single it out for a while. Area attacks still hit it.",
  mpCost: 5,
  target: "ally",
  area: "single",
  notSelf: true,
  effect: {
    type: "status",
    status: {
      id: "smoke",
      name: "Smoke",
      effect: "smoke",
      harmful: false,
      stat: "magic",
      power: 0,
      interval: 100,
      ticks: 1,
    },
  },
};

/** Rogue: a dagger strike that hits a badly hurt enemy far harder. */
export const coupDeGrace: Skill = {
  id: "coupDeGrace",
  name: "Coup de Grâce",
  description: "A dagger strike; against an enemy below 30% HP it deals x2.5.",
  mpCost: 8,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 1, finisher: 2.5 },
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

/**
 * Knight: for a while, the Knight and every ally in its row take less
 * physical damage (defense x1.5).
 */
export const shieldWall: Skill = {
  id: "shield-wall",
  name: "Shield Wall",
  description:
    "You and every ally in your row raise your guard: defense x1.5 for a while.",
  mpCost: 6,
  target: "self",
  area: "row",
  effect: {
    type: "modify",
    modifier: {
      name: "Shield Wall",
      stat: "defense",
      op: "mul",
      value: 1.5,
      duration: 150,
      harmful: false,
    },
  },
};

/**
 * Knight: stands guard over an ally next to it; for a while, enemies'
 * single-target hits on that ally land on the Knight instead.
 */
export const guard: Skill = {
  id: "guard",
  name: "Guard",
  description:
    "Stand guard over an ally next to you: for a while, single-target hits on it land on you instead.",
  mpCost: 5,
  target: "ally",
  area: "single",
  notSelf: true,
  adjacent: true,
  effect: {
    type: "status",
    status: {
      id: "guarded",
      name: "Guarded",
      effect: "guard",
      harmful: false,
      stat: "attack",
      power: 0,
      interval: 150,
      ticks: 1,
    },
  },
};

/**
 * Knight: rams an enemy with its shield, knocking it a row back; if
 * something is in the way, it crashes into it for x1.5 impact.
 */
export const shieldBash: Skill = {
  id: "shield-bash",
  name: "Shield Bash",
  description:
    "Ram an enemy within reach: x0.8 damage and it is knocked a row back. Blocked, it crashes for x1.5 impact instead.",
  mpCost: 5,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 0.8, push: 1 },
};

/**
 * Knight: runs to the front row of its column and strikes from there, so
 * a Knight pushed or placed back gets back into the line in one action.
 */
export const charge: Skill = {
  id: "charge",
  name: "Charge",
  description:
    "Run to the front of your column and strike an enemy within reach from there. The way must be clear.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  effect: { type: "strike", power: 1, advance: true },
};

/**
 * Knight: pulls an adjacent ally out of the line. In the ally's column the
 * Knight takes the middle row and the ally the back row behind it; both
 * cells must be free. Being dragged back halves the ally's gauge; the
 * Knight braces (defense x1.3) until about its next turn.
 */
export const rescue: Skill = {
  id: "rescue",
  name: "Rescue",
  description:
    "Pull an ally next to you back out of the line: in its column you take the middle row and it the back row behind you. It loses half its turn gauge; you brace (defense x1.3) until about your next turn.",
  mpCost: 7,
  target: "ally",
  area: "single",
  notSelf: true,
  adjacent: true,
  effect: { type: "rescue" },
};

/**
 * Sage: lays bare one enemy's weak points; for a while it takes x1.3 from
 * every damage type (EXPOSE_FACTOR). Immune stays immune.
 */
export const expose: Skill = {
  id: "expose",
  name: "Expose",
  description:
    "Lays bare one enemy's weak points: it takes x1.3 damage of every type for a while.",
  mpCost: 8,
  target: "enemy",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "exposed",
      name: "Exposed",
      effect: "expose",
      harmful: true,
      stat: "magic",
      power: 0,
      interval: 150,
      ticks: 1,
    },
  },
};

/**
 * Sage: words that bind an enemy's tongue. For a while (150 game time) it
 * can't use skills, only attack, move, defend or wait; a cast it is in the
 * middle of fizzles. Harmful, so Cure removes it.
 */
export const silence: Skill = {
  id: "silence",
  name: "Silence",
  description:
    "Binds one enemy's tongue: for a while it can't use skills, and a skill it is casting fizzles.",
  mpCost: 9,
  target: "enemy",
  area: "single",
  effect: {
    type: "status",
    status: {
      id: "silenced",
      name: "Silenced",
      effect: "silence",
      harmful: true,
      stat: "magic",
      power: 0,
      interval: 150,
      ticks: 1,
    },
  },
};

/**
 * Sage: an arcane bolt (x0.8) that also burns 10 MP off its target, so a
 * caster has fewer skills left. Little use on foes without MP.
 */
export const manaBurn: Skill = {
  id: "mana-burn",
  name: "Mana Burn",
  description: "An arcane bolt (x0.8) that burns away 10 of the target's MP.",
  mpCost: 7,
  target: "enemy",
  area: "single",
  effect: {
    type: "damage",
    kind: "magical",
    element: "arcane",
    power: 0.8,
    burnMp: 10,
  },
};

/**
 * Sage: an arcane bolt (x1.0) that hits x1.6 an empowered target: one
 * casting, or with a helpful status or modifier (isEmpowered).
 */
export const rebuke: Skill = {
  id: "rebuke",
  name: "Rebuke",
  description:
    "An arcane bolt (x1.0) that strikes x1.6 at an enemy casting a spell or strengthened by a helpful effect.",
  mpCost: 6,
  target: "enemy",
  area: "single",
  effect: {
    type: "damage",
    kind: "magical",
    element: "arcane",
    power: 1,
    vsEmpowered: 1.6,
  },
};

/**
 * Sage: an arcane wave down one enemy row. Its power is shared by everyone
 * it hits: a lone enemy takes the most, a crowded row a little each.
 */
export const arcaneWave: Skill = {
  id: "arcane-wave",
  name: "Arcane Wave",
  description:
    "An arcane wave through one enemy row: x2 power shared by everyone hit, at most x1.5 each.",
  mpCost: 10,
  target: "enemy",
  area: "row",
  effect: {
    type: "damage",
    kind: "magical",
    element: "arcane",
    power: 1.5,
    split: 2,
  },
};

/** Fighter: braces for a while; its own defense doubles. */
export const ironStance: Skill = {
  id: "iron-stance",
  name: "Iron Stance",
  description: "Brace yourself: your defense x2 for a while.",
  mpCost: 4,
  target: "self",
  area: "single",
  effect: {
    type: "modify",
    modifier: {
      name: "Iron Stance",
      stat: "defense",
      op: "mul",
      value: 2,
      duration: 150,
      harmful: false,
    },
  },
};

/** Fighter: catches its breath and heals a quarter of its max HP. */
export const secondWind: Skill = {
  id: "second-wind",
  name: "Second Wind",
  description: "Catch your breath: heal a quarter of your max HP.",
  mpCost: 6,
  target: "self",
  area: "single",
  effect: { type: "heal", power: 0.25, of: "maxHp" },
};

/** Fighter: rallies its row; it and every ally in it hit harder. */
export const warCry: Skill = {
  id: "war-cry",
  name: "War Cry",
  description:
    "Rally your row: you and every ally in it get attack x1.3 for a while.",
  mpCost: 5,
  target: "self",
  area: "row",
  effect: {
    type: "modify",
    modifier: {
      name: "War Cry",
      stat: "attack",
      op: "mul",
      value: 1.3,
      duration: 150,
      harmful: false,
    },
  },
};

export const skills = [
  heal,
  revive,
  fireball,
  meteor,
  regen,
  cure,
  cleave,
  provoke,
  ironStance,
  secondWind,
  warCry,
  aimedShot,
  volley,
  pinningShot,
  quickShot,
  fireArrow,
  lightningBolt,
  manaTap,
  frostLance,
  armorPierce,
  staggeringThrust,
  weakeningStrike,
  skewer,
  hook,
  haste,
  slow,
  quicken,
  timeBomb,
  rewind,
  drain,
  bloodBolt,
  firebolt,
  summonImp,
  curse,
  sacrifice,
  vanish,
  shadowstep,
  poisonBlade,
  smokeBomb,
  coupDeGrace,
  aegis,
  lastRites,
  raiseBoulder,
  shatter,
  upheaval,
  shieldWall,
  guard,
  shieldBash,
  charge,
  rescue,
  expose,
  silence,
  manaBurn,
  rebuke,
  arcaneWave,
  smite,
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
  skills: [cleave, provoke, ironStance, secondWind, warCry],
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
    speed: 12,
  },
  weapon: bow,
  skills: [aimedShot, volley, pinningShot, quickShot, fireArrow],
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
  skills: [fireball, meteor, lightningBolt, manaTap, frostLance],
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
  skills: [heal, regen, cure, revive, smite],
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
  skills: [skewer, hook, armorPierce, staggeringThrust, weakeningStrike],
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
  skills: [haste, slow, quicken, timeBomb, rewind],
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
  skills: [drain, bloodBolt, summonImp, curse, sacrifice],
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
  skills: [vanish, shadowstep, poisonBlade, smokeBomb, coupDeGrace],
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

/**
 * Protector of the line: heavy and slow, with a lance. Where the Fighter
 * draws attacks, the Knight makes its row harder to break.
 */
export const knight: CombatantDef = {
  id: "knight",
  name: "Knight",
  stats: {
    maxHp: 125,
    maxMp: 18,
    attack: 18,
    magic: 6,
    defense: 22,
    spirit: 12,
    speed: 8,
  },
  weapon: lance,
  skills: [shieldWall, guard, shieldBash, charge, rescue],
  preferredRow: 0,
};

/**
 * Knowledge and counter-magic: where the Mage destroys and the Healer
 * restores, the Sage weakens enemies and undoes what they do.
 */
export const sage: CombatantDef = {
  id: "sage",
  name: "Sage",
  stats: {
    maxHp: 75,
    maxMp: 45,
    attack: 6,
    magic: 18,
    defense: 7,
    spirit: 20,
    speed: 11,
  },
  weapon: tome,
  skills: [expose, silence, manaBurn, rebuke, arcaneWave],
  preferredRow: 2,
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
  knight,
  sage,
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
