import {
  cellOf,
  isAlive,
  type BattleEvent,
  type BattleState,
  type Cell,
  type Position,
  type Side,
  type Unit,
} from "../engine";
import { ATTACK, canTarget, type Menu } from "./turnMenu";

// When the board shows cover: on enemies that can't be singled out while
// the player aims, on the cells of a move that would end in cover, and on
// party members an enemy couldn't single out while its action is shown.

/** Whether a living unit of `side` stands in front of `position`, not counting `ignoreId`. */
export function isCoveredAt(
  state: BattleState,
  side: Side,
  position: Position,
  ignoreId?: string,
): boolean {
  return state.units.some(
    (u) =>
      u.side === side &&
      u.id !== ignoreId &&
      isAlive(u) &&
      u.position.col === position.col &&
      u.position.row < position.row,
  );
}

/**
 * Whether `unit` can't be singled out by `active` in `menu` only because of
 * the units in front of it: it isn't a target now, but would be with them
 * gone. Only for an attack or a single-target skill; areas land anyway.
 */
export function coveredFrom(
  state: BattleState,
  active: Unit | null,
  menu: Menu,
  unit: Unit,
): boolean {
  if (!active || unit.side === active.side || !isAlive(unit)) return false;
  const singles =
    menu.kind === "attack" ||
    (menu.kind === "skill" && menu.skill.area === "single");
  if (!singles) return false;
  if (!isCoveredAt(state, unit.side, unit.position)) return false;
  const cell = cellOf(unit);
  if (canTarget(state, active, menu, cell)) return false;
  const inFront = (u: Unit) =>
    u.side === unit.side &&
    u.position.col === unit.position.col &&
    u.position.row < unit.position.row;
  const open: BattleState = {
    ...state,
    units: state.units.map((u) => (inFront(u) ? { ...u, hp: 0 } : u)),
  };
  return canTarget(open, active, menu, cell);
}

/** Whether a step to `cell` in the move menu would leave `active` covered. */
export function coveredAfterMove(
  state: BattleState,
  active: Unit | null,
  menu: Menu,
  cell: Cell,
): boolean {
  if (!active || menu.kind !== "move") return false;
  if (!canTarget(state, active, menu, cell)) return false;
  return isCoveredAt(state, cell.side, cell, active.id);
}

/**
 * The party members an enemy's action couldn't single out because of
 * cover, from the state before it acted. Only for an enemy's attack or
 * single-target skill; empty for anything else.
 */
export function coveredFromAction(
  before: BattleState,
  action: BattleEvent | undefined,
): string[] {
  if (action?.type !== "attack" && action?.type !== "skill") return [];
  const actor = before.units.find((u) => u.id === action.unitId);
  if (!actor || actor.side !== "enemy") return [];
  let menu: Menu = ATTACK;
  if (action.type === "skill") {
    const skill = actor.skills.find((s) => s.id === action.skillId);
    if (action.delayed || !skill || skill.area !== "single") return [];
    menu = { kind: "skill", skill, aim: null };
  }
  return before.units
    .filter((u) => coveredFrom(before, actor, menu, u))
    .map((u) => u.id);
}
