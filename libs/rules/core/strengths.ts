import type { StatusDef } from "./format";

// The multipliers some statuses carry: how much more or less a unit deals
// or takes, its defence, or its ambush. Each status skill can set its own
// (a designer's "Lesser Blessing"); these are the defaults when it doesn't.

/** The strengths a status can carry. */
export interface Strengths {
  /** Damage the unit deals, times (Weaken 0.75, Blessing 1.2). */
  dealt?: number;
  /** Damage the unit takes of every type, times (Expose 1.3, Petrify 0.5). */
  taken?: number;
  /** The unit's defence, times (Stone Skin 1.5). */
  defence?: number;
  /** Its first damaging action out of stealth, times (Vanish 2). */
  ambush?: number;
}

/** The kinds of strength that matter to each status effect. */
export const STRENGTH_DEFAULTS: Partial<
  Record<StatusDef["effect"], Strengths>
> = {
  expose: { taken: 1.3 },
  weaken: { dealt: 0.75 },
  bless: { dealt: 1.2, taken: 0.8 },
  petrify: { taken: 0.5 },
  stoneSkin: { defence: 1.5 },
  stealth: { ambush: 2 },
};

/** A status's strengths: its own where set, else the defaults for its kind. */
export function strengthsOf(def: StatusDef): Strengths {
  const defaults = STRENGTH_DEFAULTS[def.effect] ?? {};
  const out: Strengths = {};
  for (const key of Object.keys(defaults) as (keyof Strengths)[]) {
    out[key] = def[key] ?? defaults[key];
  }
  return out;
}
