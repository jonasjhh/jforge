// A pinning hit (the Archer's Pinning Shot) nails the target in place for a
// while: it acts less often. Built into the strike, not a general second
// effect, as with Rescue's brace.

/** What a pinning hit leaves on a target that survives it. */
export const PIN_SLOW = {
  name: "Pinned",
  stat: "speed",
  op: "mul",
  value: 0.7,
  duration: 120,
  harmful: true,
} as const;
