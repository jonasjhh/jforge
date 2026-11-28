// Core battle types. Everything here is plain data so a battle can be
// saved, sent to the Worker, or replayed. The design format (stats,
// weapons, statuses, skills, creatures) is @jforge/rules/core's.

import type {
  Creature,
  DamageType,
  Resistances,
  Skill,
  StatName,
  Stats,
  StatusDef,
  Weapon,
} from "@jforge/rules/core";

// The format, for melee's own files; other packages take it from rules.
export { DAMAGE_TYPES, STAT_NAMES, TRAITS } from "@jforge/rules/core";
export type {
  Creature,
  DamageType,
  Resistances,
  Skill,
  SkillArea,
  SkillEffect,
  StatName,
  Stats,
  StatusDef,
  Trait,
  Weapon,
} from "@jforge/rules/core";

export type Side = "player" | "enemy";

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

/** One cell of the battlefield, on either side. */
export interface Cell {
  side: Side;
  col: number;
  row: number;
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
  /** HP added to `amount` each time the unit acts (see StatusDef.worsens). */
  growth?: number;
  /** The unit that applied it. */
  sourceId: string;
  /** Its strengths, fixed when it was applied (see strengths.ts). */
  dealt?: number;
  taken?: number;
  defense?: number;
  ambush?: number;
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
  /**
   * Cost of a far target: up to this much off its score for the farthest
   * (see `farness` in grid.ts), none for the one straight ahead. A unit's profile is laid over
   * DEFAULT_TARGETING, so a profile without it takes the default.
   */
  near?: number;
  /** Bonus when the expected hit would knock the target out. */
  finish: number;
  /** Bonus scaled by how much HP the target has lost. */
  wounded: number;
  /** Bonus scaled by how little the target's defense blocks. */
  soft: number;
  /** Random spread (seeded), so the AI is not fully predictable. */
  noise: number;
}

/** A creature as melee's battle takes it: with how it picks targets and how
 * dangerous it is. */
export interface CombatantDef extends Creature {
  /** How it picks targets when AI-controlled; a sensible default if absent. */
  targeting?: TargetingProfile;
  /** How dangerous a monster is, for building encounters to a budget. */
  threat?: number;
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
  /**
   * Its HP when its last turn ended (or the battle began, or it was
   * revived): what Rewind brings it back up to.
   */
  rewindHp: number;
  mp: number;
  /** Bracing since its last turn: hits are halved until it acts again. */
  defending?: boolean;
  /** 0..GAUGE_FULL; the unit acts when it is full. */
  gauge: number;
  modifiers: Modifier[];
}

type Phase =
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
  | {
      type: "statusWorsened";
      unitId: string;
      statusId: string;
      name: string;
      /** HP per tick from now, before resistances. */
      amount: number;
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
  | { type: "mpBurned"; unitId: string; amount: number; mp: number }
  | { type: "summoned"; unitId: string; byId: string; cell: Cell }
  | { type: "vanished"; unitId: string }
  | { type: "ambush"; unitId: string }
  | { type: "shattered"; unitId: string; byId: string }
  | { type: "unmoved"; unitId: string }
  | { type: "shieldBroken"; unitId: string; name: string }
  | { type: "warded"; unitId: string; name: string }
  /** `unitId` was pulled back behind its rescuer `byId`. */
  | { type: "rescued"; unitId: string; byId: string }
  | { type: "mpRestored"; unitId: string; amount: number; mp: number }
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
  /** A bomb the unit carried went off; its damage events follow. */
  | { type: "exploded"; unitId: string; name: string }
  | { type: "modifierExpired"; unitId: string; source: string }
  | { type: "battleOver"; winner: Side | null };

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}
