import type { Skill, SkillEffect } from "@jforge/melee/shared";

/** The effects the skill designer can edit. Others pass through untouched. */
export const EDITABLE_EFFECTS = ["damage", "strike", "heal", "modify"] as const;
export type EditableEffect = (typeof EDITABLE_EFFECTS)[number];

export const EFFECT_LABELS: Record<EditableEffect, string> = {
  damage: "Spell damage",
  strike: "Weapon strike",
  heal: "Heal",
  modify: "Buff or debuff",
};

export function isEditable(effect: SkillEffect): boolean {
  return (EDITABLE_EFFECTS as readonly string[]).includes(effect.type);
}

/** A sensible starting effect of each kind. */
export function defaultEffect(type: EditableEffect): SkillEffect {
  switch (type) {
    case "damage":
      return { type: "damage", kind: "magical", element: "fire", power: 1 };
    case "strike":
      return { type: "strike", power: 1.5 };
    case "heal":
      return { type: "heal", power: 1 };
    case "modify":
      return {
        type: "modify",
        modifier: {
          name: "Boost",
          stat: "attack",
          op: "mul",
          value: 1.5,
          duration: 100,
          harmful: false,
        },
      };
  }
}

/**
 * Where a new effect is usually aimed, so switching the effect of a skill
 * also gives it a target that makes sense.
 */
export function defaultTarget(effect: SkillEffect): Skill["target"] {
  if (effect.type === "heal") return "ally";
  if (effect.type === "modify")
    return effect.modifier.harmful ? "enemy" : "ally";
  return "enemy";
}

/** One line on what a skill does, from its data: "Fire damage x1.2, plus". */
export function effectSummary(skill: Skill): string {
  const { effect } = skill;
  const shape = skill.area === "single" ? "" : `, ${skill.area}`;
  switch (effect.type) {
    case "damage":
      return `${effect.element} damage ×${effect.power}${effect.split ? ` each, ×${effect.split} shared` : ""}${effect.vsEmpowered ? ` (×${effect.vsEmpowered} if empowered)` : ""}${effect.burnMp ? `, burns ${effect.burnMp} MP` : ""}${effect.chill ? ", chills" : ""}${shape}`;
    case "strike":
      return `${effect.advance ? "charging " : ""}weapon strike ×${effect.power}${effect.pin ? ", pins" : ""}${effect.ignite ? ", sets burning" : ""}${effect.weaken ? ", weakens" : ""}${effect.stagger ? `, staggers ${effect.stagger * 100}%` : ""}${effect.armorPierce ? `, ignores ${effect.armorPierce * 100}% defense` : ""}${effect.finisher ? `, ×${effect.finisher} below 30% HP` : ""}${shape}`;
    case "heal":
      return `heals ×${effect.power} ${effect.of === "maxHp" ? "max HP" : "magic"}${shape}`;
    case "modify": {
      const m = effect.modifier;
      const change = m.op === "mul" ? `×${m.value}` : signed(m.value);
      return `${m.stat} ${change} for ${m.duration}${shape}`;
    }
    case "status":
      if (effect.status.effect === "bomb") {
        const st = effect.status;
        return `bomb: ${st.damageType} damage ×${st.power} ${st.stat} after ${st.interval}, plus`;
      }
      if (effect.status.effect === "damage") {
        const st = effect.status;
        return `${st.damageType ?? ""} damage ×${st.power} ${st.stat} over ${st.ticks} ticks${shape}`;
      }
      if (effect.status.effect === "coat") {
        return `coats the blade: weapon hits poison for ${effect.status.interval}`;
      }
      if (effect.status.effect === "smoke") {
        return `hides an ally: can't be singled out for ${effect.status.interval}`;
      }
      return `status${shape}`;
    case "sacrifice": {
      const m = effect.modifier;
      return `gives up a summon: heals by its HP, ${m.stat} ×${m.value} for ${m.duration}`;
    }
    case "rewind":
      return `gives back the HP lost since its last turn${shape}`;
    case "restoreMp":
      return `restores ${effect.amount} MP${shape}`;
    default:
      return `${effect.type}${shape}`;
  }
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** What stops a skill from being usable, in words; empty when it is fine. */
export function skillProblems(skill: Skill): string[] {
  const problems: string[] = [];
  if (skill.name.trim() === "") problems.push("Give the skill a name.");
  if (skill.mpCost < 0) problems.push("MP cost can't be negative.");
  const { effect } = skill;
  if (
    (effect.type === "damage" ||
      effect.type === "strike" ||
      effect.type === "heal") &&
    effect.power <= 0
  ) {
    problems.push("Power must be above 0.");
  }
  if (effect.type === "strike" && skill.target !== "enemy") {
    problems.push("A weapon strike must target an enemy.");
  }
  if (effect.type === "modify" && effect.modifier.duration <= 0) {
    problems.push("A buff or debuff needs a duration.");
  }
  return problems;
}
