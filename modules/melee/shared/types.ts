// Core battle types. Everything here is plain data so a battle can be
// saved, sent to the Worker, or replayed.

export type Side = "player" | "enemy";

export const STAT_NAMES = [
  "maxHp",
  "maxMp",
  "attack",
  "magic",
  "defense",
  "spirit",
  "speed",
] as const;

export type StatName = (typeof STAT_NAMES)[number];
export type Stats = Record<StatName, number>;

/** Grid cell on one side. Row 0 is the front, row 2 the back. */
export interface Position {
  col: number;
  row: number;
}

/** A modifier changes one stat; statuses, buffs and equipment are modifiers. */
export interface Modifier {
  stat: StatName;
  op: "add" | "mul";
  value: number;
  /** What applied it, e.g. "haste". Shown in events. */
  source: string;
  /** Game time at which it ends; absent means permanent. */
  expiresAt?: number;
  /** Harmful modifiers (Slow) are removed by Cure; helpful ones are not. */
  harmful?: boolean;
}

/**
 * What a hit is made of; resistances key on this. Independent of delivery
 * (physical uses attack vs defense, magical uses magic vs spirit): a
 * Geomancer's thrown rock is magical delivery with an impact type.
 * One type per hit. See docs/design.md, "Damage types".
 */
export const PHYSICAL_TYPES = [
  "slash",
  "pierce",
  "chop",
  "crush",
  "impact",
] as const;
export const MAGICAL_TYPES = [
  "fire",
  "cold",
  "lightning",
  "acid",
  "poison",
  "holy",
  "shadow",
  "arcane",
] as const;
export const DAMAGE_TYPES = [...PHYSICAL_TYPES, ...MAGICAL_TYPES] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/**
 * Damage multipliers per type: 2 weak, 1 normal (the default for any type
 * not listed), 0.5 resistant, 0 immune.
 */
export type Resistances = Partial<Record<DamageType, number>>;

/**
 * What a creature is made of. Each trait brings default resistances (see
 * traits.ts); a creature's own `resistances` override them.
 */
export const TRAITS = [
  "beast",
  "reptile",
  "ooze",
  "stone",
  "demon",
  "undead",
  "construct",
  "armored",
] as const;
export type Trait = (typeof TRAITS)[number];

/**
 * What a combatant attacks with; decides which enemies it can reach.
 * Columns line up across the two grids: column 2 faces enemy column 2.
 */
export interface Weapon {
  id: string;
  name: string;
  /**
   * Enemy columns it reaches: this many on each side of the attacker's own
   * column (1 = its own column and both neighbours), or "any".
   */
  columns: number | "any";
  /**
   * How deep into a column it reaches, counting living units from the
   * front: 1 = only the front-most (cover blocks the rest), 2 = also the
   * one behind it, or "any" to ignore cover.
   */
  depth: number | "any";
  damageType: DamageType;
  /**
   * Melee hits depend on rows (weaker from and into the back); ranged
   * weapons ignore rows.
   */
  kind: "melee" | "ranged";
  /** A status every damaging hit puts on the target, e.g. venom. */
  onHit?: StatusDef;
  /**
   * The holder's gauge at the start of a battle; absent means 0. Below 0
   * it acts later than its speed alone would make it (a bow: -500).
   */
  startGauge?: number;
}

/** One cell of the battlefield, on either side. */
export interface Cell {
  side: Side;
  col: number;
  row: number;
}

/**
 * An effect over time a skill can put on a unit: something happens every
 * `interval` of game time, `ticks` times. Game time, not turns, so haste
 * does not stretch it. More kinds (poison, burn) arrive later.
 */
export interface StatusDef {
  id: string;
  name: string;
  /** What each tick does to the unit carrying it. */
  /**
   * heal / damage: HP per tick. stealth: hidden until it ends. shield:
   * absorbs `power x stat` damage before HP. ward: can't be knocked out
   * (a lethal hit leaves 1 HP). taunt: enemies that single out a target
   * must pick it while they can. expose: takes more from every damage type
   * (see EXPOSE_FACTOR). guard: single-target hits from enemies land on
   * the unit that applied it instead, while it stands (see guard.ts). The
   * last six just last until they end.
   */
  effect:
    | "heal"
    | "damage"
    | "stealth"
    | "shield"
    | "ward"
    | "taunt"
    | "expose"
    | "silence"
    | "guard";
  /** Harmful statuses (poison) are removed by Cure; helpful ones (Regen) are not. */
  harmful: boolean;
  /** For damage ticks: the type resistances apply to. */
  damageType?: DamageType;
  /** Which of the applier's stats scales it. */
  stat: "attack" | "magic";
  /** Per tick: power x the applier's `stat`, worked out when applied. */
  power: number;
  interval: number;
  ticks: number;
}

/** A status effect running on a unit. */
export interface Status {
  id: string;
  name: string;
  effect: StatusDef["effect"];
  damageType?: DamageType;
  harmful: boolean;
  /** HP per tick before resistances, fixed when it was applied. */
  amount: number;
  interval: number;
  nextTickAt: number;
  ticksLeft: number;
  /** The unit that applied it. */
  sourceId: string;
}

/** What a skill does to each unit it hits. More effect types arrive later. */
export type SkillEffect =
  | {
      type: "status";
      status: StatusDef;
    }
  /** Removes every harmful status and modifier from the target. */
  | { type: "cleanse" }
  /** Moves the caster to the aimed empty cell on its own side. */
  | { type: "teleport" }
  /** A timed stat modifier, e.g. Haste (speed x1.5) or Slow (x0.5). */
  | {
      type: "modify";
      modifier: {
        name: string;
        stat: StatName;
        op: "add" | "mul";
        value: number;
        /** Game time it lasts. */
        duration: number;
        harmful: boolean;
      };
    }
  /**
   * Sets the target's turn gauge to `to` (a share of full): 1 means it acts
   * right away. Not on a unit that is already ready or casting.
   */
  | { type: "gauge"; to: number }
  /**
   * A weapon attack: uses the attacker's weapon (reach, rows, damage type)
   * at `power` times normal. `push` moves the target that many rows back
   * (negative pulls it forward). If the way is blocked by a unit (knocked
   * out or not) or the edge of the grid, it doesn't move and takes a
   * collision instead: x1.5 damage. `ignoreCover` lets it reach units
   * behind others in their column (the weapon's column limit still holds).
   * `advance` first runs the attacker to the front row of its column (the
   * way there must be clear, and it must not be there already), and it
   * strikes from there (see charge.ts).
   */
  | {
      type: "strike";
      power: number;
      push?: number;
      ignoreCover?: boolean;
      advance?: boolean;
    }
  | {
      type: "heal";
      /**
       * HP restored = power x the caster's magic, or with `of: "maxHp"`
       * power x the target's max HP (Second Wind: 0.25 is a quarter).
       */
      power: number;
      of?: "maxHp";
    }
  | {
      type: "damage";
      kind: "magical";
      element: DamageType;
      /** Damage = power x magic x K / (K + target's spirit), +-10%. */
      power: number;
      /** Share of the damage dealt that heals the caster, e.g. 0.5. */
      drain?: number;
    }
  /**
   * Puts `creature` in the aimed cell on the caster's own side, controlled
   * like the caster. One per caster: summoning again replaces the old one.
   * A summon vanishes (leaving no body) when knocked out.
   */
  | {
      type: "summon";
      creature: CombatantDef;
      /** How many of this creature one caster may have; default 1. */
      limit?: number;
      /** May be placed on either side (boulders), not just the caster's. */
      anySide?: boolean;
    }
  /**
   * Destroys one of the caster's obstacles (a boulder); every unit in the
   * plus around its cell takes magic damage, friend or foe.
   */
  | { type: "shatter"; power: number; element: DamageType }
  /** Moves the target `rows` back on its own side; blocked means no move. */
  | { type: "heave"; rows: number }
  /**
   * Brings a knocked-out ally back with power x the caster's magic in HP.
   * Its gauge starts empty. Not for summons (they vanish) or obstacles.
   */
  | { type: "revive"; power: number }
  /**
   * Pulls the aimed ally back: in its column the caster takes the middle
   * row and the ally the back row; the ally's gauge halves and the caster
   * braces (see rescue.ts).
   */
  | { type: "rescue" };

/**
 * Which cells a skill hits around the aimed cell. The two grids form one
 * battlefield 5 wide and 6 deep, front rows touching, so an area can spill
 * across the front line onto the other side. "row" is the aimed cell's whole
 * row on its own side. "reach" ignores the aimed cell's surroundings: it
 * covers every enemy the caster's weapon can reach.
 */
export type SkillArea = "single" | "plus" | "square" | "line" | "row" | "reach";

/** A skill is plain data, so char can design new ones later. */
export interface Skill {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  /**
   * Where it may be aimed, relative to the caster: a living ally or enemy,
   * or "any" cell on either side (occupied or empty).
   */
  target: "ally" | "enemy" | "any" | "self";
  area: SkillArea;
  effect: SkillEffect;
  /**
   * Game time between choosing the skill and its impact. While casting the
   * unit cannot act; if it is knocked out the skill fizzles. Absent means
   * instant.
   */
  castTime?: number;
  /** True if the caster may not target itself (e.g. Quicken). */
  notSelf?: boolean;
  /**
   * True if it may only be aimed at a unit next to the caster: one cell
   * across or along, on the same side (e.g. Guard).
   */
  adjacent?: boolean;
  /**
   * True if it can't be used from the front row, where the caster is
   * locked in hand-to-hand combat (e.g. Aimed Shot).
   */
  notFromFront?: boolean;
  /** HP paid to use it. Refused unless the caster has more HP than this. */
  hpCost?: number;
  /** Costs only half a turn, like Move: the gauge drops to half. */
  halfTurn?: boolean;
}

/** A delayed skill on its way: aimed, paid for, landing at `readyAt`. */
export interface Casting {
  skillId: string;
  skillName: string;
  cell: Cell;
  /** The cells it will hit, fixed when the cast starts. */
  area: Cell[];
  startedAt: number;
  readyAt: number;
}

/**
 * How an AI-controlled unit weighs the targets it can reach. Each factor
 * scores 0..1 and is multiplied by its weight; the highest total wins.
 */
export interface TargetingProfile {
  /** Bonus when the expected hit would knock the target out. */
  finish: number;
  /** Bonus scaled by how much HP the target has lost. */
  wounded: number;
  /** Bonus scaled by how little the target's defense blocks. */
  soft: number;
  /** Random spread (seeded), so the AI is not fully predictable. */
  noise: number;
}

/** What a combatant is, independent of any battle. */
export interface CombatantDef {
  id: string;
  name: string;
  stats: Stats;
  weapon: Weapon;
  skills?: Skill[];
  /** How it picks targets when AI-controlled; a sensible default if absent. */
  targeting?: TargetingProfile;
  /** Default resistances come from traits; `resistances` overrides them. */
  traits?: Trait[];
  resistances?: Resistances;
  /** Row it prefers when placed automatically: 0 front, 1 middle, 2 back. */
  preferredRow?: number;
  /**
   * An obstacle (a boulder): takes up its cell, gives cover and can be
   * attacked, but never acts.
   */
  obstacle?: boolean;
  /** How dangerous a monster is, for building encounters to a budget. */
  threat?: number;
  /**
   * Whose icon it wears, as the id of a built-in type ("fighter", "slime").
   * For combatants designed elsewhere; built-in ones use their own id.
   */
  portrait?: string;
}

/** Puts a combatant on the grid for one battle. */
export interface Placement {
  def: CombatantDef;
  side: Side;
  position: Position;
  /** Who chooses this unit's actions. Defaults to player side = player. */
  control?: Control;
  modifiers?: Modifier[];
}

export type Control = "player" | "ai";

export interface BattleSetup {
  placements: Placement[];
}

/** A combatant during a battle. */
export interface Unit {
  /**
   * Unique within the battle: "<side>-<col>-<row>" of its starting cell.
   * It does not change when the unit moves; use `position` for where it is.
   */
  id: string;
  defId: string;
  /** The built-in type whose icon it wears; its own `defId` if absent. */
  portrait?: string;
  name: string;
  side: Side;
  control: Control;
  position: Position;
  base: Stats;
  weapon: Weapon;
  skills: Skill[];
  targeting: TargetingProfile;
  resistances: Resistances;
  /** A delayed skill this unit is casting, if any. */
  casting?: Casting;
  /** Effects over time running on this unit. */
  statuses: Status[];
  /** Set for summoned units: who summoned it. */
  summonedBy?: string;
  /** An obstacle (boulder): never acts, can't be helped by ally skills. */
  obstacle?: boolean;
  /** A summon that is gone: off the grid, no body. */
  vanished?: boolean;
  hp: number;
  mp: number;
  /** Bracing since its last turn: hits are halved until it acts again. */
  defending?: boolean;
  /** 0..GAUGE_FULL; the unit acts when it is full. */
  gauge: number;
  modifiers: Modifier[];
}

export type Phase =
  | { kind: "running" }
  | { kind: "awaitingCommand"; unitId: string }
  | { kind: "over"; winner: Side | null };

export interface BattleState {
  /** Game time elapsed. */
  time: number;
  units: Unit[];
  /** Units whose gauge is full, in the order they will act. */
  ready: string[];
  phase: Phase;
  /** Seeded random generator state. */
  rng: number;
  /** Summons made so far, for unique IDs ("summon-1", ...). */
  summons: number;
}

export type Command =
  | { type: "attack"; targetId: string }
  | { type: "skill"; skillId: string; cell: Cell }
  /** Step to an adjacent empty cell on the unit's own side. */
  | { type: "move"; to: Position }
  /** Brace: hits are halved until the unit's next action. A full turn. */
  | { type: "defend" }
  /** Do nothing and act again soon: the gauge keeps three quarters. */
  | { type: "wait" };

export type BattleEvent =
  | { type: "timeAdvanced"; time: number }
  | { type: "turnReady"; unitId: string }
  | { type: "attack"; unitId: string; targetId: string }
  | {
      type: "damage";
      unitId: string;
      amount: number;
      hp: number;
      damageType: DamageType;
      /** The target's resistance multiplier: above 1 weak, below 1 resisted. */
      multiplier: number;
      /** Damage a shield took instead of HP (`amount` is the HP lost). */
      absorbed?: number;
    }
  | {
      type: "skill";
      unitId: string;
      /** The aimed cell. */
      cell: Cell;
      /** The unit in the aimed cell when the skill was used, if any. */
      targetId?: string;
      /** Every cell the skill covers (the aimed cell for single target). */
      area: Cell[];
      skillId: string;
      skillName: string;
      /** The caster's MP after paying for the skill. */
      mp: number;
      /** True when this is the impact of a delayed skill. */
      delayed?: boolean;
    }
  | {
      type: "castStarted";
      unitId: string;
      skillId: string;
      skillName: string;
      cell: Cell;
      area: Cell[];
      readyAt: number;
      mp: number;
    }
  | { type: "castFizzled"; unitId: string; skillName: string }
  | {
      type: "statusApplied";
      unitId: string;
      statusId: string;
      name: string;
      ticks: number;
    }
  | {
      type: "statusTick";
      unitId: string;
      statusId: string;
      name: string;
      effect: StatusDef["effect"];
      amount: number;
      hp: number;
      /** For damage ticks: the type and the target's multiplier for it. */
      damageType?: DamageType;
      multiplier?: number;
      /** Damage a shield took instead of HP. */
      absorbed?: number;
    }
  | { type: "statusExpired"; unitId: string; statusId: string; name: string }
  | { type: "statusRemoved"; unitId: string; statusId: string; name: string }
  | { type: "pushed"; unitId: string; from: Position; to: Position }
  | {
      type: "modifierApplied";
      unitId: string;
      source: string;
      harmful: boolean;
    }
  | { type: "gaugeChanged"; unitId: string; gauge: number }
  | { type: "hpPaid"; unitId: string; amount: number; hp: number }
  | { type: "summoned"; unitId: string; byId: string; cell: Cell }
  | { type: "vanished"; unitId: string }
  | { type: "ambush"; unitId: string }
  | { type: "shattered"; unitId: string; byId: string }
  | { type: "unmoved"; unitId: string }
  | { type: "shieldBroken"; unitId: string; name: string }
  | { type: "warded"; unitId: string; name: string }
  /** `unitId` was pulled back behind its rescuer `byId`. */
  | { type: "rescued"; unitId: string; byId: string }
  /** A hit aimed at `unitId` lands on its guardian `byId` instead. */
  | { type: "guarded"; unitId: string; byId: string }
  | { type: "teleported"; unitId: string; from: Position; to: Position }
  | {
      type: "collided";
      unitId: string;
      /** The unit in the way, or absent when it hit the edge of the grid. */
      blockerId?: string;
    }
  | { type: "heal"; unitId: string; amount: number; hp: number }
  | { type: "revived"; unitId: string; hp: number }
  | { type: "moved"; unitId: string; from: Position; to: Position }
  | { type: "defended"; unitId: string }
  | { type: "waited"; unitId: string }
  | { type: "knockedOut"; unitId: string }
  | { type: "modifierExpired"; unitId: string; source: string }
  | { type: "battleOver"; winner: Side | null };

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}
