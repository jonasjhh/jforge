import { chooseCommand } from "./ai";
import { physicalDamage } from "./damage";
import { MAX_PARTY_SIZE, isOnGrid, unitId } from "./grid";
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
    return {
      id: unitId(p.side, p.position),
      defId: p.def.id,
      name: p.def.name,
      side: p.side,
      control: p.control ?? (p.side === "player" ? "player" : "ai"),
      position: { ...p.position },
      base: { ...p.def.stats },
      hp: p.def.stats.maxHp,
      mp: p.def.stats.maxMp,
      gauge: 0,
      modifiers: (p.modifiers ?? []).map((m) => ({ ...m })),
    };
  });

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
  };
}

/**
 * Runs the battle until a player-controlled unit needs a command or the
 * battle ends. AI units act on their own along the way.
 */
export function advance(state: BattleState): StepResult {
  if (state.phase.kind !== "running") return { state, events: [] };
  const next = structuredClone(state);
  const events: BattleEvent[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    if (next.phase.kind !== "running") break;
    if (endIfDecided(next, events)) break;

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
      continue;
    }

    const dt = timeToNextEvent(next);
    if (dt === Infinity) {
      next.phase = { kind: "over", winner: null };
      events.push({ type: "battleOver", winner: null });
      break;
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
  const target = state.units.find((u) => u.id === command.targetId);
  if (!target) return "Unknown target";
  if (target.side === unit.side) return "Cannot attack an ally";
  if (!isAlive(target)) return "Target is already knocked out";
  return null;
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
  const target = getUnit(state, command.targetId);
  events.push({ type: "attack", unitId: unit.id, targetId: target.id });
  const amount = physicalDamage(state, unit, target);
  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: "damage", unitId: target.id, amount, hp: target.hp });
  if (target.hp === 0) {
    target.gauge = 0;
    state.ready = state.ready.filter((id) => id !== target.id);
    events.push({ type: "knockedOut", unitId: target.id });
  }
  finishTurn(state, unit);
}

function finishTurn(state: BattleState, unit: Unit): void {
  unit.gauge = 0;
  state.ready = state.ready.filter((id) => id !== unit.id);
}

/** Ends the battle if one side has no living units. */
function endIfDecided(state: BattleState, events: BattleEvent[]): boolean {
  const alive = (side: Side) =>
    state.units.some((u) => u.side === side && isAlive(u));
  const players = alive("player");
  const enemies = alive("enemy");
  if (players && enemies) return false;
  const winner: Side | null = players ? "player" : enemies ? "enemy" : null;
  state.phase = { kind: "over", winner };
  events.push({ type: "battleOver", winner });
  return true;
}
