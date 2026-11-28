import type { CombatantDef, Resistances, Trait } from "./types";

/**
 * Default resistances per trait: 2 weak, 0.5 resistant, 0 immune. A
 * creature with several traits multiplies them (immune stays immune).
 */
export const TRAIT_RESISTANCES: Record<Trait, Resistances> = {
  beast: { pierce: 1.5 },
  reptile: { cold: 1.5 },
  ooze: { crush: 0.5, pierce: 0.5, fire: 2, cold: 1.5, poison: 0 },
  stone: {
    slash: 0.5,
    pierce: 0.5,
    crush: 1.5,
    impact: 2,
    poison: 0,
  },
  demon: { holy: 2, fire: 0.5, shadow: 0.5 },
  undead: { holy: 2, shadow: 0.5, poison: 0 },
  construct: { slash: 0.5, crush: 1.5, lightning: 1.5, poison: 0 },
  armoured: {
    slash: 0.75,
    pierce: 0.75,
    chop: 1.25,
    crush: 1.25,
    lightning: 1.25,
    acid: 1.5,
  },
};

/** A creature's resistances: its traits' defaults, then its overrides. */
export function resistancesFor(def: CombatantDef): Resistances {
  const result: Resistances = {};
  for (const trait of def.traits ?? []) {
    for (const [type, value] of Object.entries(TRAIT_RESISTANCES[trait])) {
      const key = type as keyof Resistances;
      result[key] = (result[key] ?? 1) * value;
    }
  }
  return { ...result, ...def.resistances };
}
