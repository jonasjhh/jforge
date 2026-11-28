import {
  act,
  advance,
  createBattle,
  validateCommand,
} from "@jforge/battle/engine/battle.ts";
import { GRID_COLUMNS, GRID_ROWS } from "@jforge/battle/engine/grid.ts";
import { reachableTargets } from "@jforge/battle/engine/reach.ts";
import { skillCells } from "@jforge/battle/engine/skills.ts";
import type {
  BattleSetup,
  BattleState,
  Command,
  StepResult,
  Unit,
} from "@jforge/battle/engine/types.ts";

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
