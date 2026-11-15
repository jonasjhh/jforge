import { knockOutIfDown, resistance } from "./damage";
import { effectiveStat, isAlive } from "./stats";
import type {
  BattleEvent,
  BattleState,
  SkillEffect,
  StatusDef,
  Unit,
} from "./types";

// Float tolerance for "a tick is due".
const EPSILON = 1e-9;

/**
 * Puts a status on `target`. Reapplying the same status refreshes it (new
 * amount, full duration) instead of stacking a second copy. A damaging
 * status doesn't take hold on a target immune to its damage type.
 */
export function applyStatus(
  state: BattleState,
  caster: Unit,
  target: Unit,
  def: StatusDef,
  events: BattleEvent[],
): void {
  if (def.damageType && resistance(target, def.damageType) === 0) return;
  const amount = Math.max(
    1,
    Math.round(def.power * effectiveStat(caster, def.stat)),
  );
  target.statuses = target.statuses.filter((s) => s.id !== def.id);
  target.statuses.push({
    id: def.id,
    name: def.name,
    effect: def.effect,
    ...(def.damageType ? { damageType: def.damageType } : {}),
    harmful: def.harmful,
    amount,
    interval: def.interval,
    nextTickAt: state.time + def.interval,
    ticksLeft: def.ticks,
    sourceId: caster.id,
  });
  events.push({
    type: "statusApplied",
    unitId: target.id,
    statusId: def.id,
    name: def.name,
    ticks: def.ticks,
  });
}

/** Game time until the next status tick on any living unit. */
export function timeToNextTick(state: BattleState): number {
  let next = Infinity;
  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    for (const status of unit.statuses) {
      next = Math.min(next, status.nextTickAt - state.time);
    }
  }
  return next;
}

/** Runs every tick that is due now. Returns true if any ran. */
export function runDueTicks(
  state: BattleState,
  events: BattleEvent[],
): boolean {
  let ran = false;
  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    for (const status of [...unit.statuses]) {
      if (status.nextTickAt > state.time + EPSILON) continue;
      ran = true;
      tick(state, unit, status, events);
      // A damage tick can knock the unit out, which clears its statuses.
      if (!isAlive(unit)) break;
      status.ticksLeft -= 1;
      if (status.ticksLeft <= 0) {
        unit.statuses = unit.statuses.filter((s) => s !== status);
        events.push({
          type: "statusExpired",
          unitId: unit.id,
          statusId: status.id,
          name: status.name,
        });
      } else {
        status.nextTickAt += status.interval;
      }
    }
  }
  return ran;
}

function tick(
  state: BattleState,
  unit: Unit,
  status: Unit["statuses"][number],
  events: BattleEvent[],
): void {
  switch (status.effect) {
    case "stealth":
      // Nothing happens on its single tick: it just ends.
      break;
    case "damage": {
      const multiplier = status.damageType
        ? resistance(unit, status.damageType)
        : 1;
      const amount = Math.min(unit.hp, Math.round(status.amount * multiplier));
      unit.hp -= amount;
      events.push({
        type: "statusTick",
        unitId: unit.id,
        statusId: status.id,
        name: status.name,
        effect: status.effect,
        amount,
        hp: unit.hp,
        ...(status.damageType ? { damageType: status.damageType } : {}),
        multiplier,
      });
      knockOutIfDown(state, unit, events);
      break;
    }
    case "heal": {
      const amount = Math.min(unit.base.maxHp - unit.hp, status.amount);
      unit.hp += amount;
      events.push({
        type: "statusTick",
        unitId: unit.id,
        statusId: status.id,
        name: status.name,
        effect: status.effect,
        amount,
        hp: unit.hp,
      });
      break;
    }
  }
}

/**
 * Removes every harmful status (Poison) and harmful timed modifier (Slow)
 * from `target`, reporting each one.
 */
export function cleanse(target: Unit, events: BattleEvent[]): void {
  for (const status of target.statuses.filter((s) => s.harmful)) {
    events.push({
      type: "statusRemoved",
      unitId: target.id,
      statusId: status.id,
      name: status.name,
    });
  }
  target.statuses = target.statuses.filter((s) => !s.harmful);
  for (const modifier of target.modifiers.filter((m) => m.harmful)) {
    events.push({
      type: "statusRemoved",
      unitId: target.id,
      statusId: modifier.source,
      name: modifier.source,
    });
  }
  target.modifiers = target.modifiers.filter((m) => !m.harmful);
}

/**
 * Puts a timed modifier on `target`. Reapplying the same one (same name)
 * refreshes its duration instead of stacking.
 */
export function applyModifier(
  state: BattleState,
  target: Unit,
  def: Extract<SkillEffect, { type: "modify" }>["modifier"],
  events: BattleEvent[],
): void {
  target.modifiers = target.modifiers.filter((m) => m.source !== def.name);
  target.modifiers.push({
    stat: def.stat,
    op: def.op,
    value: def.value,
    source: def.name,
    expiresAt: state.time + def.duration,
    harmful: def.harmful,
  });
  events.push({
    type: "modifierApplied",
    unitId: target.id,
    source: def.name,
    harmful: def.harmful,
  });
}
