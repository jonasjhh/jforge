// A seeded random number generator whose whole state is one number, so a
// fight's state stays plain data. Mulberry32.

/** The next number in [0, 1) and the state after it. */
export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** A generator for code that draws many numbers in one go. */
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    const { value, state: next } = nextRandom(state);
    state = next;
    return value;
  };
}
