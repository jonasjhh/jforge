import type { StatusDef } from "./types";

// A burning hit (the Archer's Fire Arrow) sets its target alight: fire
// damage over time on top of the strike's own damage. Built into the
// strike, not a general second effect, as with Pinning Shot's pin.

/** What a burning hit leaves on a target that survives it. */
export const IGNITE_BURN: StatusDef = {
  id: "burning",
  name: "Burning",
  effect: "damage",
  harmful: true,
  damageType: "fire",
  stat: "attack",
  power: 0.15,
  interval: 30,
  ticks: 5,
};
