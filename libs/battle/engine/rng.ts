import type { BattleState } from "./types";

/**
 * Next random number in [0, 1), advancing the generator stored in the
 * state (mulberry32). Only call on a state the caller owns.
 */
export function nextRandom(state: BattleState): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  return scramble(state.rng);
}

/** A standalone seeded generator, for things outside a battle. */
export function createRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    return scramble(s);
  };
}

function scramble(value: number): number {
  let t = value;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
