import { effectiveStat, isAlive } from "./stats";
import type { BattleEvent, BattleState, Skill, Unit } from "./types";

/** Why `unit` cannot use `skill` on `target` right now, or null if it can. */
export function validateSkill(
  unit: Unit,
  skill: Skill | undefined,
  target: Unit | undefined,
): string | null {
  if (!skill) return "Unknown skill";
  if (unit.mp < skill.mpCost) return `Not enough MP for ${skill.name}`;
  if (!target) return "Unknown target";
  const sameSide = target.side === unit.side;
  if (skill.target === "ally" && !sameSide) {
    return `${skill.name} targets an ally`;
  }
  if (skill.target === "enemy" && sameSide) {
    return `${skill.name} targets an enemy`;
  }
  if (!isAlive(target)) return "Target is knocked out";
  return null;
}

/** Units `unit` may use `skill` on (empty if it cannot afford it). */
export function skillTargets(
  state: BattleState,
  unit: Unit,
  skill: Skill,
): Unit[] {
  return state.units.filter((t) => validateSkill(unit, skill, t) === null);
}

/** Pays for and applies a skill that has already been validated. */
export function resolveSkill(
  unit: Unit,
  skill: Skill,
  target: Unit,
  events: BattleEvent[],
): void {
  unit.mp -= skill.mpCost;
  events.push({
    type: "skill",
    unitId: unit.id,
    targetId: target.id,
    skillId: skill.id,
    skillName: skill.name,
    mp: unit.mp,
  });

  switch (skill.effect.type) {
    case "heal": {
      const power = skill.effect.power * effectiveStat(unit, "magic");
      const amount = Math.min(
        target.base.maxHp - target.hp,
        Math.max(1, Math.round(power)),
      );
      target.hp += amount;
      events.push({ type: "heal", unitId: target.id, amount, hp: target.hp });
      break;
    }
  }
}
