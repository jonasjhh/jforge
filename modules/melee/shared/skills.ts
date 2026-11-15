import { applyDamage, magicalDamage } from "./damage";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  areaCells,
  isCellOnGrid,
  unitAt,
} from "./grid";
import { effectiveStat, isAlive } from "./stats";
import type { BattleEvent, BattleState, Cell, Skill, Unit } from "./types";

/** Why `unit` cannot aim `skill` at `cell` right now, or null if it can. */
export function validateSkill(
  state: BattleState,
  unit: Unit,
  skill: Skill | undefined,
  cell: Cell,
): string | null {
  if (!skill) return "Unknown skill";
  if (unit.mp < skill.mpCost) return `Not enough MP for ${skill.name}`;
  if (!isCellOnGrid(cell)) return "That cell is off the battlefield";
  if (skill.target === "any") return null;

  const target = unitAt(state, cell);
  if (!target) return `${skill.name} needs a target in that cell`;
  const sameSide = target.side === unit.side;
  if (skill.target === "ally" && !sameSide) {
    return `${skill.name} targets an ally`;
  }
  if (skill.target === "enemy" && sameSide) {
    return `${skill.name} targets an enemy`;
  }
  if (!isAlive(target)) return "Target is knocked out";
  return null;
}

/** Every cell `unit` may aim `skill` at (empty if it cannot afford it). */
export function skillCells(
  state: BattleState,
  unit: Unit,
  skill: Skill,
): Cell[] {
  const cells: Cell[] = [];
  for (const side of ["enemy", "player"] as const) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        const cell = { side, col, row };
        if (validateSkill(state, unit, skill, cell) === null) cells.push(cell);
      }
    }
  }
  return cells;
}

/** The living units a skill aimed at `cell` would hit, friend or foe. */
export function skillVictims(
  state: BattleState,
  skill: Skill,
  cell: Cell,
): Unit[] {
  return areaCells(cell, skill.area).flatMap((c) => {
    const unit = unitAt(state, c);
    return unit && isAlive(unit) ? [unit] : [];
  });
}

/** Pays for and applies a skill that has already been validated. */
export function resolveSkill(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
  events: BattleEvent[],
): void {
  unit.mp -= skill.mpCost;
  events.push({
    type: "skill",
    unitId: unit.id,
    cell,
    area: areaCells(cell, skill.area),
    skillId: skill.id,
    skillName: skill.name,
    mp: unit.mp,
  });

  // Victims are fixed before any effect lands, so order doesn't matter.
  for (const target of skillVictims(state, skill, cell)) {
    const effect = skill.effect;
    switch (effect.type) {
      case "heal": {
        const power = effect.power * effectiveStat(unit, "magic");
        const amount = Math.min(
          target.base.maxHp - target.hp,
          Math.max(1, Math.round(power)),
        );
        target.hp += amount;
        events.push({ type: "heal", unitId: target.id, amount, hp: target.hp });
        break;
      }
      case "damage":
        applyDamage(
          state,
          target,
          magicalDamage(state, unit, target, effect.power),
          events,
        );
        break;
    }
  }
}
