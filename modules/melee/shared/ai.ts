import { defenseFactor, expectedPhysicalDamage, wouldKnockOut } from "./damage";
import { reachableTargets } from "./reach";
import { nextRandom } from "./rng";
import { effectiveStat } from "./stats";
import type { BattleState, Command, TargetingProfile, Unit } from "./types";

/** Used for combatants that don't define their own targeting. */
export const DEFAULT_TARGETING: TargetingProfile = {
  finish: 3,
  wounded: 2,
  soft: 1,
  noise: 0.5,
};

/**
 * How attractive `target` is to `unit`: finish it off, pile onto the
 * wounded, pick on the soft, plus a little seeded randomness.
 */
export function targetScore(
  state: BattleState,
  unit: Unit,
  target: Unit,
): number {
  const p = unit.targeting;
  const canFinish = wouldKnockOut(target, expectedPhysicalDamage(unit, target))
    ? 1
    : 0;
  const wounded = 1 - target.hp / target.base.maxHp;
  const soft = defenseFactor(effectiveStat(target, "defense"));
  return (
    p.finish * canFinish +
    p.wounded * wounded +
    p.soft * soft +
    p.noise * nextRandom(state)
  );
}

/**
 * AI turn: attack the reachable enemy with the highest target score.
 * Monsters only attack for now; skills and movement come later.
 */
export function chooseCommand(state: BattleState, unit: Unit): Command | null {
  let best: { target: Unit; score: number } | null = null;
  for (const target of reachableTargets(state, unit)) {
    const score = targetScore(state, unit, target);
    if (!best || score > best.score) best = { target, score };
  }
  return best ? { type: "attack", targetId: best.target.id } : null;
}
