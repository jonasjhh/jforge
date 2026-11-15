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
}

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
}

/** One cell of the battlefield, on either side. */
export interface Cell {
  side: Side;
  col: number;
  row: number;
}

/** What a skill does to each unit it hits. More effect types arrive later. */
export type SkillEffect =
  | {
      type: "heal";
      /** HP restored = power x the caster's magic. */
      power: number;
    }
  | {
      type: "damage";
      kind: "magical";
      /** Damage = power x magic x K / (K + target's spirit), +-10%. */
      power: number;
    };

/**
 * Which cells a skill hits around the aimed cell. The two grids form one
 * battlefield 5 wide and 6 deep, front rows touching, so an area can spill
 * across the front line onto the other side.
 */
export type SkillArea = "single" | "plus";

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
  target: "ally" | "enemy" | "any";
  area: SkillArea;
  effect: SkillEffect;
}

/** What a combatant is, independent of any battle. */
export interface CombatantDef {
  id: string;
  name: string;
  stats: Stats;
  weapon: Weapon;
  skills?: Skill[];
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
  name: string;
  side: Side;
  control: Control;
  position: Position;
  base: Stats;
  weapon: Weapon;
  skills: Skill[];
  hp: number;
  mp: number;
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
}

export type Command =
  | { type: "attack"; targetId: string }
  | { type: "skill"; skillId: string; cell: Cell }
  /** Step to an adjacent empty cell on the unit's own side. */
  | { type: "move"; to: Position };

export type BattleEvent =
  | { type: "timeAdvanced"; time: number }
  | { type: "turnReady"; unitId: string }
  | { type: "attack"; unitId: string; targetId: string }
  | { type: "damage"; unitId: string; amount: number; hp: number }
  | {
      type: "skill";
      unitId: string;
      /** The aimed cell. */
      cell: Cell;
      /** Every cell the skill covers (the aimed cell for single target). */
      area: Cell[];
      skillId: string;
      skillName: string;
      /** The caster's MP after paying for the skill. */
      mp: number;
    }
  | { type: "heal"; unitId: string; amount: number; hp: number }
  | { type: "moved"; unitId: string; from: Position; to: Position }
  | { type: "knockedOut"; unitId: string }
  | { type: "modifierExpired"; unitId: string; source: string }
  | { type: "battleOver"; winner: Side | null };

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}
