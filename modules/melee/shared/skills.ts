import { applyDamage, magicalHit, physicalHit } from "./damage";
import { COLLISION_POWER, moveBy, pushBlocker, pushDestination } from "./push";
import { canReach } from "./reach";
import { breakStealth, isStealthed } from "./stealth";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  areaCells,
  isCellOnGrid,
  unitAt,
} from "./grid";
import { applyModifier, applyStatus, cleanse } from "./status";
import { GAUGE_FULL } from "./timeline";
import { effectiveStat, isAlive } from "./stats";
import { makeUnit, vanish } from "./units";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Skill,
  SkillEffect,
  Unit,
} from "./types";

/** Why `unit` cannot aim `skill` at `cell` right now, or null if it can. */
export function validateSkill(
  state: BattleState,
  unit: Unit,
  skill: Skill | undefined,
  cell: Cell,
): string | null {
  if (!skill) return "Unknown skill";
  if (unit.mp < skill.mpCost) return `Not enough MP for ${skill.name}`;
  if (skill.hpCost && unit.hp <= skill.hpCost) {
    return `Not enough HP for ${skill.name}`;
  }
  if (!isCellOnGrid(cell)) return "That cell is off the battlefield";
  if (skill.effect.type === "teleport") {
    if (cell.side !== unit.side) return "Move within your own side";
    if (unitAt(state, cell)) return "That cell is occupied";
    return null;
  }
  if (skill.effect.type === "summon") {
    // An empty cell (on the caster's side unless anySide), or the cell of
    // one of the caster's own summons of that kind, which it replaces.
    const { creature, anySide } = skill.effect;
    if (!anySide && cell.side !== unit.side) return "Summon on your own side";
    const there = unitAt(state, cell);
    const ownKind =
      there?.summonedBy === unit.id &&
      there.defId === creature.id &&
      isAlive(there);
    if (there && !ownKind) return "That cell is occupied";
    return null;
  }
  if (skill.effect.type === "heave") {
    const target = unitAt(state, cell);
    if (!target || !isAlive(target)) return `${skill.name} needs a unit there`;
    if (target.side !== unit.side && isStealthed(target)) {
      return `${target.name} can't be seen`;
    }
    return null;
  }
  if (skill.effect.type === "shatter") {
    const boulder = unitAt(state, cell);
    if (
      !boulder ||
      !boulder.obstacle ||
      !isAlive(boulder) ||
      boulder.summonedBy !== unit.id
    ) {
      return `${skill.name} needs one of your boulders`;
    }
    return null;
  }
  if (skill.target === "any") return null;

  const target = unitAt(state, cell);
  if (!target) return `${skill.name} needs a target in that cell`;
  const sameSide = target.side === unit.side;
  if (target.obstacle && skill.target === "ally") {
    return `${skill.name} can't target a boulder`;
  }
  if ((skill.target === "ally" || skill.target === "self") && !sameSide) {
    return `${skill.name} targets an ally`;
  }
  if (skill.target === "enemy" && sameSide) {
    return `${skill.name} targets an enemy`;
  }
  if (!isAlive(target)) return "Target is knocked out";
  if (skill.target === "self" && target.id !== unit.id) {
    return `${skill.name} can only target its caster`;
  }
  if (!sameSide && skill.area === "single" && isStealthed(target)) {
    return `${target.name} can't be seen`;
  }
  if (skill.notSelf && target.id === unit.id) {
    return `${skill.name} can't target its caster`;
  }
  if (skill.effect.type === "gauge") {
    if (target.casting) return `${target.name} is busy casting`;
    if (state.ready.includes(target.id))
      return `${target.name} is already ready`;
  }
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
  if (skill.hpCost) {
    unit.hp -= skill.hpCost;
    events.push({
      type: "hpPaid",
      unitId: unit.id,
      amount: skill.hpCost,
      hp: unit.hp,
    });
  }
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

  if (skill.effect.type === "summon") {
    summon(state, unit, skill.effect, cell, events);
    return;
  }
  if (skill.effect.type === "shatter") {
    const boulder = unitAt(state, cell);
    if (boulder) {
      vanish(boulder);
      events.push({ type: "shattered", unitId: boulder.id, byId: unit.id });
    }
    for (const target of skillVictims(state, skill, cell)) {
      const hit = magicalHit(
        state,
        unit,
        target,
        skill.effect.power,
        skill.effect.element,
      );
      applyDamage(state, target, hit, events);
    }
    return;
  }
  if (skill.effect.type === "heave") {
    const target = unitAt(state, cell);
    if (target) {
      const to = pushDestination(state, target, skill.effect.rows);
      if (to) moveBy(target, to, events);
      else events.push({ type: "unmoved", unitId: target.id });
    }
    return;
  }
  if (skill.effect.type === "teleport") {
    const from = { ...unit.position };
    unit.position = { col: cell.col, row: cell.row };
    events.push({
      type: "teleported",
      unitId: unit.id,
      from,
      to: { ...unit.position },
    });
    return;
  }
  // The first damaging action out of stealth is an ambush.
  const ambush =
    skill.effect.type === "damage" || skill.effect.type === "strike"
      ? breakStealth(unit, events)
      : 1;

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
      case "modify":
        applyModifier(state, target, effect.modifier, events);
        break;
      case "gauge":
        target.gauge = effect.to * GAUGE_FULL;
        events.push({
          type: "gaugeChanged",
          unitId: target.id,
          gauge: target.gauge,
        });
        // A full gauge means it acts next, right after this turn ends.
        if (target.gauge >= GAUGE_FULL && !state.ready.includes(target.id)) {
          state.ready.splice(state.ready[0] === unit.id ? 1 : 0, 0, target.id);
        }
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
        const power = effect.power * (blocked ? COLLISION_POWER : 1) * ambush;
        applyDamage(
          state,
          target,
          physicalHit(
            state,
            unit,
            target,
            power,
            // A crash into something is impact damage.
            blocked ? "impact" : unit.weapon.damageType,
          ),
          events,
        );
        if (to && isAlive(target)) moveBy(target, to, events);
        break;
      }
      case "damage": {
        const hit = magicalHit(
          state,
          unit,
          target,
          effect.power * ambush,
          effect.element,
        );
        const suffered = applyDamage(state, target, hit, events);
        if (effect.drain && isAlive(unit)) {
          const amount = Math.min(
            unit.base.maxHp - unit.hp,
            // Only damage that got through (not into a shield) is drained.
            Math.floor(suffered.lost * effect.drain),
          );
          if (amount > 0) {
            unit.hp += amount;
            events.push({ type: "heal", unitId: unit.id, amount, hp: unit.hp });
          }
        }
        break;
      }
    }
  }
}

/**
 * Puts a new unit for the effect's creature in `cell`, controlled like the
 * caster. If the aimed cell holds one of the caster's summons of that kind,
 * it is replaced; otherwise, at the limit, the oldest one vanishes.
 */
function summon(
  state: BattleState,
  caster: Unit,
  effect: Extract<SkillEffect, { type: "summon" }>,
  cell: Cell,
  events: BattleEvent[],
): void {
  const { creature } = effect;
  const limit = effect.limit ?? 1;
  const mine = () =>
    state.units.filter(
      (u) =>
        u.summonedBy === caster.id && u.defId === creature.id && !u.vanished,
    );
  const remove = (old: Unit) => {
    vanish(old);
    state.ready = state.ready.filter((id) => id !== old.id);
    events.push({ type: "vanished", unitId: old.id });
  };
  const inCell = unitAt(state, cell);
  if (inCell && mine().includes(inCell)) remove(inCell);
  // Oldest first: units are appended as they are summoned.
  while (mine().length >= limit) remove(mine()[0]!);

  state.summons += 1;
  const unit = makeUnit(
    creature,
    cell.side,
    { col: cell.col, row: cell.row },
    caster.control,
    `summon-${state.summons}`,
  );
  unit.summonedBy = caster.id;
  state.units.push(unit);
  events.push({ type: "summoned", unitId: unit.id, byId: caster.id, cell });
}
