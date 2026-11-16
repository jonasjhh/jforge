import { act, advance, createBattle, validateCommand } from "../battle";
import { randomEncounter, DIFFICULTIES } from "../encounters";
import { GRID_COLUMNS, GRID_ROWS } from "../grid";
import { reachableTargets } from "../reach";
import { skillCells } from "../skills";
import type {
  BattleSetup,
  BattleState,
  Command,
  StepResult,
  Unit,
} from "../types";

/**
 * A command for a waiting party member that exercises the whole engine:
 * every fifth turn it steps if it can, every other turn it tries its
 * skills (rotating which one and where it aims), otherwise it attacks.
 */
function botCommand(state: BattleState, unit: Unit, turn: number): Command {
  if (turn % 5 === 4) {
    const move = firstMove(state, unit);
    if (move) return move;
  }
  if (turn % 2 === 0 && unit.skills.length > 0) {
    for (let i = 0; i < unit.skills.length; i++) {
      const skill = unit.skills[(turn / 2 + i) % unit.skills.length]!;
      const cells = skillCells(state, unit, skill);
      if (cells.length > 0) {
        return {
          type: "skill",
          skillId: skill.id,
          cell: cells[turn % cells.length]!,
        };
      }
    }
  }
  const targets = reachableTargets(state, unit);
  if (targets.length > 0) {
    return { type: "attack", targetId: targets[turn % targets.length]!.id };
  }
  const move = firstMove(state, unit);
  if (move) return move;
  throw new Error(`${unit.name} has nothing to do`);
}

function firstMove(state: BattleState, unit: Unit): Command | null {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLUMNS; col++) {
      const move: Command = { type: "move", to: { col, row } };
      if (validateCommand(state, unit, move) === null) return move;
    }
  }
  return null;
}

/** Plays a battle to the end with the bot, one action per step. */
export function playWithBot(setup: BattleSetup, seed: number): StepResult[] {
  let state = createBattle(setup, seed);
  const steps: StepResult[] = [];
  for (let turn = 0; turn < 5000; turn++) {
    if (state.phase.kind === "over") return steps;
    const step =
      state.phase.kind === "awaitingCommand"
        ? act(state, botCommand(state, getActive(state), turn))
        : advance(state, { stopAfterAction: true });
    steps.push(step);
    state = step.state;
  }
  throw new Error("Battle did not finish");
}

function getActive(state: BattleState): Unit {
  if (state.phase.kind !== "awaitingCommand") throw new Error("No turn");
  const id = state.phase.unitId;
  return state.units.find((u) => u.id === id)!;
}

/** Random encounters across difficulties, played by the bot. */
export function botBattles(count: number): {
  name: string;
  steps: StepResult[];
}[] {
  return DIFFICULTIES.flatMap((difficulty) =>
    Array.from({ length: count }, (_, i) => {
      const seed = 1000 + i * 7919;
      return {
        name: `${difficulty} #${seed}`,
        steps: playWithBot(randomEncounter(seed, difficulty), seed),
      };
    }),
  );
}

/** A short, stable fingerprint of any JSON-able value (FNV-1a). */
export function digest(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
