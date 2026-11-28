import {
  randomEncounter,
  type BattleSetup,
  type Difficulty,
  type EncounterPools,
} from "@jforge/battle";
import { monsters, playerTypes } from "./content";

// Melee's arena: its test units against its test monsters.

/** Melee's own party and monster pool. */
export const MELEE_POOLS: EncounterPools = { party: playerTypes, monsters };

/** A random encounter of melee's units; the same seed gives the same one. */
export function meleeEncounter(
  seed: number,
  difficulty: Difficulty,
): BattleSetup {
  return randomEncounter(seed, difficulty, MELEE_POOLS);
}
