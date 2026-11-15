import { chooseCommand } from "./ai";
import { makeUnit } from "./units";
import { applyDamage, physicalHit } from "./damage";
import { MAX_PARTY_SIZE, isOnGrid, unitId } from "./grid";
import { canReach } from "./reach";
import { MOVE_GAUGE_LEFT, resolveMove, validateMove } from "./move";
import { breakStealth } from "./stealth";
import { landCast, castSkill, validateSkill } from "./skills";
import { applyStatus, runDueTicks } from "./status";
import { isAlive } from "./stats";
import { advanceTime, timeToNextEvent } from "./timeline";
import type {
  BattleEvent,
  BattleSetup,
  BattleState,
  Command,
  Side,
  StepResult,
  Unit,
} from "./types";

// Guards against an engine bug looping forever; no real battle gets close.
const MAX_STEPS = 100_000;

/** Builds the starting state. Throws if the setup is invalid. */
export function createBattle(setup: BattleSetup, seed: number): BattleState {
  const units: Unit[] = setup.placements.map((p) => {
    if (!isOnGrid(p.position)) {
      throw new Error(`${p.def.name} is off the grid`);
    }
    return makeUnit(
      p.def,
      p.side,
      p.position,
      p.control ?? (p.side === "player" ? "player" : "ai"),
      unitId(p.side, p.position),
      p.modifiers,
    );
  });

  nameDuplicates(units);

  const ids = new Set<string>();
  for (const unit of units) {
    if (ids.has(unit.id)) throw new Error(`Two units share cell ${unit.id}`);
    ids.add(unit.id);
  }
  const players = units.filter((u) => u.side === "player").length;
  if (players === 0) throw new Error("The player side is empty");
  if (players > MAX_PARTY_SIZE) {
    throw new Error(`At most ${MAX_PARTY_SIZE} player units`);
  }
  if (!units.some((u) => u.side === "enemy")) {
    throw new Error("The enemy side is empty");
  }

  return {
    time: 0,
    units,
    ready: [],
    phase: { kind: "running" },
    rng: seed | 0,
    summons: 0,
  };
}

export interface AdvanceOptions {
  /** Stop when game time reaches this, so a UI can show gauges filling. */
  until?: number;
  /** Stop right after an AI unit acts, so a UI can show the action. */
  stopAfterAction?: boolean;
}

/**
 * Runs the battle until a player-controlled unit needs a command or the
 * battle ends (or earlier, see `options`). AI units act on their own along
 * the way.
 */
export function advance(
  state: BattleState,
  options: AdvanceOptions = {},
): StepResult {
  if (state.phase.kind !== "running") return { state, events: [] };
  const next = structuredClone(state);
  const events: BattleEvent[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    if (next.phase.kind !== "running") break;
    if (endIfDecided(next, events)) break;

    // Delayed skills land before anyone due at the same moment acts.
    const landing = next.units.find(
      (u) => u.casting && u.casting.readyAt <= next.time + 1e-9,
    );
    if (landing) {
      landCast(next, landing, events);
      if (options.stopAfterAction) {
        endIfDecided(next, events);
        break;
      }
      continue;
    }

    // Effects over time tick on their own; they don't pause the battle.
    if (runDueTicks(next, events)) continue;

    const readyId = next.ready[0];
    if (readyId !== undefined) {
      const unit = getUnit(next, readyId);
      if (unit.control === "player") {
        next.phase = { kind: "awaitingCommand", unitId: unit.id };
        break;
      }
      const command = chooseCommand(next, unit);
      if (command) resolve(next, unit, command, events);
      else finishTurn(next, unit);
      if (options.stopAfterAction) {
        endIfDecided(next, events);
        break;
      }
      continue;
    }

    const dt = timeToNextEvent(next);
    if (dt === Infinity) {
      next.phase = { kind: "over", winner: null };
      events.push({ type: "battleOver", winner: null });
      break;
    }
    if (options.until !== undefined) {
      const remaining = options.until - next.time;
      if (remaining <= 0) break;
      if (dt > remaining) {
        advanceTime(next, remaining, events);
        break;
      }
    }
    advanceTime(next, dt, events);
  }
  return { state: next, events };
}

/** Carries out the waiting player unit's command. Throws if invalid. */
export function act(state: BattleState, command: Command): StepResult {
  if (state.phase.kind !== "awaitingCommand") {
    throw new Error("No unit is waiting for a command");
  }
  const next = structuredClone(state);
  const unit = getUnit(next, state.phase.unitId);
  const error = validateCommand(next, unit, command);
  if (error) throw new Error(error);
  const events: BattleEvent[] = [];
  next.phase = { kind: "running" };
  resolve(next, unit, command, events);
  endIfDecided(next, events);
  return { state: next, events };
}

/** Why a command is not allowed for this unit, or null if it is. */
export function validateCommand(
  state: BattleState,
  unit: Unit,
  command: Command,
): string | null {
  if (command.type === "move") return validateMove(state, unit, command.to);
  if (command.type === "skill") {
    const skill = unit.skills.find((s) => s.id === command.skillId);
    return validateSkill(state, unit, skill, command.cell);
  }
  const target = state.units.find((u) => u.id === command.targetId);
  if (!target) return "Unknown target";
  if (target.side === unit.side) return "Cannot attack an ally";
  if (!isAlive(target)) return "Target is already knocked out";
  if (!canReach(state, unit, target)) return "Target is out of reach";
  return null;
}

/** "Slime", "Slime" on one side become "Slime A", "Slime B". */
function nameDuplicates(units: Unit[]): void {
  const groups = new Map<string, Unit[]>();
  for (const unit of units) {
    const key = `${unit.side}:${unit.name}`;
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.forEach((unit, i) => {
      unit.name = `${unit.name} ${String.fromCharCode(65 + i)}`;
    });
  }
}

export function getUnit(state: BattleState, id: string): Unit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`Unknown unit ${id}`);
  return unit;
}

function resolve(
  state: BattleState,
  unit: Unit,
  command: Command,
  events: BattleEvent[],
): void {
  if (command.type === "move") {
    resolveMove(state, unit, command.to, events);
    return;
  }
  if (command.type === "skill") {
    const skill = unit.skills.find((s) => s.id === command.skillId);
    if (!skill) throw new Error(`Unknown skill ${command.skillId}`);
    castSkill(state, unit, skill, command.cell, events);
    finishTurn(state, unit);
    if (skill.halfTurn) unit.gauge = MOVE_GAUGE_LEFT;
    return;
  }
  const target = getUnit(state, command.targetId);
  events.push({ type: "attack", unitId: unit.id, targetId: target.id });
  const ambush = breakStealth(unit, events);
  const hit = physicalHit(state, unit, target, ambush);
  applyDamage(state, target, hit, events);
  // Venom and the like: a damaging hit on a target still standing.
  if (unit.weapon.onHit && hit.amount > 0 && isAlive(target)) {
    applyStatus(state, unit, target, unit.weapon.onHit, events);
  }
  finishTurn(state, unit);
}

function finishTurn(state: BattleState, unit: Unit): void {
  unit.gauge = 0;
  state.ready = state.ready.filter((id) => id !== unit.id);
}

/** Ends the battle if one side has no living units. */
function endIfDecided(state: BattleState, events: BattleEvent[]): boolean {
  // Summons don't keep a side in the battle on their own.
  const alive = (side: Side) =>
    state.units.some((u) => u.side === side && isAlive(u) && !u.summonedBy);
  const players = alive("player");
  const enemies = alive("enemy");
  if (players && enemies) return false;
  const winner: Side | null = players ? "player" : enemies ? "enemy" : null;
  state.phase = { kind: "over", winner };
  events.push({ type: "battleOver", winner });
  return true;
}
