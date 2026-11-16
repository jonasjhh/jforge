import { defenseFactor, expectedPhysicalDamage, wouldKnockOut } from "./damage";
import { bestMove } from "./aiMove";
import { bestSkill } from "./aiSkills";
import { attackTargets } from "./reach";
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
 * AI turn. First, if a step (or a teleport) puts the unit somewhere clearly
 * better, it moves; moving costs half a turn, so it acts again soon. Else
 * it attacks the reachable enemy with the highest target score, unless a
 * skill is worth more (see aiSkills). Each option gets the same seeded
 * noise, so battles replay exactly. Null when there is nothing to do.
 */
export function chooseCommand(state: BattleState, unit: Unit): Command | null {
  const move = bestMove(state, unit);
  if (move) return move.command;

  let best: { command: Command; score: number } | null = null;
  for (const target of attackTargets(state, unit)) {
    const score = targetScore(state, unit, target);
    if (!best || score > best.score) {
      best = { command: { type: "attack", targetId: target.id }, score };
    }
  }
  const skill = bestSkill(state, unit);
  if (skill) {
    const score = skill.value + unit.targeting.noise * nextRandom(state);
    if (!best || score > best.score) {
      best = {
        command: { type: "skill", skillId: skill.skill.id, cell: skill.cell },
        score,
      };
    }
  }
  return best?.command ?? null;
}
