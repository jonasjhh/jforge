import type { StatusDef } from "./types";

/**
 * Poison from a venomous hit: the Viper's fangs, and the Rogue's blade
 * while Poison Blade coats it (see coat.ts).
 */
export const POISON: StatusDef = {
  id: "poison",
  name: "Poison",
  effect: "damage",
  harmful: true,
  damageType: "poison",
  stat: "attack",
  power: 0.4,
  interval: 30,
  ticks: 5,
};
