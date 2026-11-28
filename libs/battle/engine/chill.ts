// A chilling hit (the Mage's Frost Lance) slows its target a little for a
// while. Built into the spell, not a general second effect, as with
// Pinning Shot's pin.

/** What a chilling hit leaves on a target that survives it. */
export const CHILL_SLOW = {
  name: "Chilled",
  stat: "speed",
  op: "mul",
  value: 0.85,
  duration: 90,
  harmful: true,
} as const;
