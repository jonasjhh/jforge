import { defenceFactor, expectedPhysicalDamage, wouldKnockOut } from "./damage";
import { bestMove } from "./aiMove";
import { hitVictim } from "./guard";
import { bestSkill } from "./aiSkills";
import { attackTargets } from "./reach";
import { nextRandom } from "./rng";
import { farness } from "./grid";
import { effectiveStat } from "./stats";
import type { BattleState, Command, TargetingProfile, Unit } from "./types";

/** Used for combatants that don't define their own targeting. */
export const DEFAULT_TARGETING: TargetingProfile = {
  near: 1,
  finish: 3,
  wounded: 1,
  soft: 1,
  noise: 0.5,
};

/**
 * How attractive `target` is to `unit`: one it can finish off, the
 * wounded, the soft, less the farther away it is, plus a little seeded
 * randomness. Distance is a cost rather than a bonus, so the nearest
 * target scores as before and attacks don't crowd out support skills.
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
  const soft = defenceFactor(effectiveStat(target, "defence"));
  return (
    -(p.near ?? 0) * farness(unit, target) +
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
    // A guarded target's blow lands on its guardian: score that one.
    const score = targetScore(state, unit, hitVictim(state, unit, target));
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
