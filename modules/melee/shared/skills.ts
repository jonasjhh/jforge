import { applyDamage, magicalHit, physicalHit } from "./damage";
import { COLLISION_POWER, moveBy, pushBlocker, pushDestination } from "./push";
import { canReach } from "./reach";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  areaCells,
  isCellOnGrid,
  unitAt,
} from "./grid";
import { applyStatus, cleanse } from "./status";
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
  if (skill.effect.type === "strike" && !canReach(state, unit, target)) {
    return "Target is out of reach";
  }
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

/**
 * Uses a skill that has already been validated. An instant skill is paid
 * for and lands now; a delayed one is paid for and starts casting.
 */
export function castSkill(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
  events: BattleEvent[],
): void {
  unit.mp -= skill.mpCost;
  if (!skill.castTime) {
    applySkill(state, unit, skill, cell, events, false);
    return;
  }
  const area = areaCells(cell, skill.area);
  const readyAt = state.time + skill.castTime;
  unit.casting = {
    skillId: skill.id,
    skillName: skill.name,
    cell,
    area,
    startedAt: state.time,
    readyAt,
  };
  events.push({
    type: "castStarted",
    unitId: unit.id,
    skillId: skill.id,
    skillName: skill.name,
    cell,
    area,
    readyAt,
    mp: unit.mp,
  });
}

/** Lands a delayed skill whose cast has finished. */
export function landCast(
  state: BattleState,
  unit: Unit,
  events: BattleEvent[],
): void {
  const casting = unit.casting;
  if (!casting) return;
  unit.casting = undefined;
  const skill = unit.skills.find((s) => s.id === casting.skillId);
  if (skill) applySkill(state, unit, skill, casting.cell, events, true);
}

/** The skill's effect on everyone in its area, right now. */
function applySkill(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
  events: BattleEvent[],
  delayed: boolean,
): void {
  const aimedAt = unitAt(state, cell);
  events.push({
    type: "skill",
    unitId: unit.id,
    cell,
    area: areaCells(cell, skill.area),
    skillId: skill.id,
    skillName: skill.name,
    mp: unit.mp,
    ...(aimedAt ? { targetId: aimedAt.id } : {}),
    ...(delayed ? { delayed: true } : {}),
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
      case "status":
        applyStatus(state, unit, target, effect.status, events);
        break;
      case "cleanse":
        cleanse(target, events);
        break;
      case "strike": {
        // Decide the move first: a blocked push hits harder instead, and
        // the crash is reported before the blow it causes.
        const to = effect.push
          ? pushDestination(state, target, effect.push)
          : undefined;
        const blocked = to === null;
        if (blocked && effect.push) {
          const blocker = pushBlocker(state, target, effect.push);
          events.push({
            type: "collided",
            unitId: target.id,
            ...(blocker ? { blockerId: blocker.id } : {}),
          });
        }
        const power = effect.power * (blocked ? COLLISION_POWER : 1);
        applyDamage(
          state,
          target,
          physicalHit(state, unit, target, power),
          events,
        );
        if (to && isAlive(target)) moveBy(target, to, events);
        break;
      }
      case "damage":
        applyDamage(
          state,
          target,
          magicalHit(state, unit, target, effect.power, effect.element),
          events,
        );
        break;
    }
  }
}
