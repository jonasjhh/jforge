import { type Difficulty } from "@jforge/battle/engine/encounters.ts";
import { meleeEncounter } from "../arena";
import { simulate } from "@jforge/battle/engine/simulate.ts";

/** Battles per difficulty: enough for a stable rate, few enough to be quick. */
const RUNS = 300;

/** How often the party wins random encounters of a difficulty, auto-played. */
export function winRate(difficulty: Difficulty): number {
  let wins = 0;
  for (let seed = 0; seed < RUNS; seed++) {
    const battle = meleeEncounter(seed, difficulty);
    if (simulate(battle, seed + 1000).winner === "player") wins++;
  }
  return wins / RUNS;
}
