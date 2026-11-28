import { advance, createBattle } from "./battle";
import { isAlive } from "./stats";
import type { BattleEvent, BattleSetup, Side } from "./types";

export interface BattleSummary {
  winner: Side | null;
  time: number;
  actions: number;
  survivors: string[];
}

/**
 * Plays a whole battle with every unit AI-controlled. Used for auto-battle,
 * tests and balance runs.
 */
export function simulate(setup: BattleSetup, seed: number): BattleSummary {
  const auto: BattleSetup = {
    placements: setup.placements.map((p) => ({ ...p, control: "ai" })),
  };
  const { state, events } = advance(createBattle(auto, seed));
  if (state.phase.kind !== "over") throw new Error("Battle did not finish");
  return {
    winner: state.phase.winner,
    time: Math.round(state.time * 100) / 100,
    actions: countActions(events),
    survivors: state.units.filter(isAlive).map((u) => u.name),
  };
}

function countActions(events: BattleEvent[]): number {
  return events.filter((e) => e.type === "attack").length;
}
