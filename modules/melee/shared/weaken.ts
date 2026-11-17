import type { StatusDef } from "./types";

// A weakening hit (the Lancer's Weakening Strike) leaves its target
// weakened: every hit it deals for a while, weapon or spell, is weaker
// (WEAKEN_FACTOR in damage.ts). Built into the strike, not a general
// second effect, as with Pinning Shot's pin.

/** What a weakening hit leaves on a target that survives it. */
export const WEAKEN_STATUS: StatusDef = {
  id: "weakened",
  name: "Weakened",
  effect: "weaken",
  harmful: true,
  stat: "attack",
  power: 0,
  interval: 150,
  ticks: 1,
};
