import { skillCost } from "./aiSkills";
import { expectedPhysicalDamage } from "./damage";
import { GRID_COLUMNS, GRID_ROWS } from "./grid";
import { validateMove } from "./move";
import { canReach, reachableTargets } from "./reach";
import { skillCells } from "./skills";
import { isAlive } from "./stats";
import type { BattleState, Command, Position, Unit } from "./types";

/** Weight of the best share of a foe's max HP its weapon takes per hit. */
export const OFFENSE_WEIGHT = 2;
/** Weight of the share of its own max HP the foes that reach it take. */
export const DANGER_WEIGHT = 1;
/**
 * A step costs half a turn; it must improve the position by this much. A
 * teleport that takes a whole turn must improve it twice as much.
 */
export const MOVE_THRESHOLD = 0.2;

/**
 * How good `unit`'s cell is: its best weapon hit there (as a share of the
 * target's max HP, so finishing blows and soft targets show) against the
 * weapon hits of every foe that could reach it there (as a share of its own
 * max HP). Melee rows and cover make this differ from cell to cell; skills
 * don't, so they are left out.
 */
export function positionValue(state: BattleState, unit: Unit): number {
  let offense = 0;
  for (const target of reachableTargets(state, unit)) {
    if (target.obstacle) continue;
    const share = expectedPhysicalDamage(unit, target) / target.base.maxHp;
    offense = Math.max(offense, share);
  }
  let danger = 0;
  for (const foe of state.units) {
    if (foe.side === unit.side || !isAlive(foe) || foe.obstacle) continue;
    if (!canReach(state, foe, unit)) continue;
    danger += expectedPhysicalDamage(foe, unit) / unit.base.maxHp;
  }
  return OFFENSE_WEIGHT * offense - DANGER_WEIGHT * danger;
}

/** positionValue as if `unit` stood at `to`. Leaves the state as it was. */
export function valueAt(state: BattleState, unit: Unit, to: Position): number {
  const from = unit.position;
  unit.position = to;
  try {
    return positionValue(state, unit);
  } finally {
    unit.position = from;
  }
}

export interface MoveChoice {
  command: Command;
  /** How much better the new cell is, after the cost of getting there. */
  gain: number;
}

/**
 * The best way for `unit` to reposition: a step to an adjacent cell, or a
 * teleport skill it can afford. Null unless it beats staying put by the
 * threshold; ties go to the first found (steps before teleports).
 */
export function bestMove(state: BattleState, unit: Unit): MoveChoice | null {
  const here = positionValue(state, unit);
  let best: MoveChoice | null = null;
  const consider = (command: Command, to: Position, threshold: number) => {
    const gain = valueAt(state, unit, to) - here - threshold;
    if (gain > 0 && (!best || gain > best.gain)) best = { command, gain };
  };

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLUMNS; col++) {
      const to = { col, row };
      if (validateMove(state, unit, to) === null) {
        consider({ type: "move", to }, to, MOVE_THRESHOLD);
      }
    }
  }
  for (const skill of unit.skills) {
    if (skill.effect.type !== "teleport") continue;
    const threshold =
      MOVE_THRESHOLD * (skill.halfTurn ? 1 : 2) + skillCost(unit, skill);
    for (const cell of skillCells(state, unit, skill)) {
      consider(
        { type: "skill", skillId: skill.id, cell },
        { col: cell.col, row: cell.row },
        threshold,
      );
    }
  }
  return best;
}
