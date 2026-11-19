import { randomEncounter, type Difficulty } from "../encounters";
import { simulate } from "../simulate";

/** Battles per difficulty: enough for a stable rate, few enough to be quick. */
const RUNS = 300;

/** How often the party wins random encounters of a difficulty, auto-played. */
export function winRate(difficulty: Difficulty): number {
  let wins = 0;
  for (let seed = 0; seed < RUNS; seed++) {
    const battle = randomEncounter(seed, difficulty);
    if (simulate(battle, seed + 1000).winner === "player") wins++;
  }
  return wins / RUNS;
}
