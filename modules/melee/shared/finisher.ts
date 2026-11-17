import type { SkillEffect, Unit } from "./types";

// A finishing strike (the Rogue's Coup de Grâce) hits a badly hurt target
// far harder. Built into the strike, not a general second effect.

/** Below this share of max HP a target counts as badly hurt. */
export const FINISH_BELOW = 0.3;

/** The multiplier a strike's `finisher` gives on `target`: 1 if none. */
export function finisherFactor(
  effect: Extract<SkillEffect, { type: "strike" }>,
  target: Unit,
): number {
  if (!effect.finisher) return 1;
  const below = effect.finishBelow ?? FINISH_BELOW;
  return target.hp < below * target.base.maxHp ? effect.finisher : 1;
}
