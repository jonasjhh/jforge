import {
  ROW_DEALT,
  type DamagePreview,
  type Skill,
  type Unit,
} from "../../shared";

// Text and labels for the battle screen, kept apart from the components so
// they can be tested.

const ROW_LABELS = ["front", "middle", "back"];

/** "15 HP" for Blood Bolt, "24 MP · delayed" for Meteor. */
export function skillCost(skill: Skill): string {
  return [
    skill.hpCost ? `${skill.hpCost} HP` : "",
    skill.mpCost || !skill.hpCost ? `${skill.mpCost} MP` : "",
    skill.castTime ? "delayed" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Enough MP, and more HP than an HP cost (it may never be fatal). */
export function canAfford(unit: Unit, skill: Skill): boolean {
  return unit.mp >= skill.mpCost && unit.hp > (skill.hpCost ?? 0);
}

/** ", front row: full damage" for melee; ranged weapons ignore rows. */
export function rowHint(unit: Unit): string {
  if (unit.weapon.kind !== "melee") return "";
  const row = unit.position.row;
  const dealt = ROW_DEALT[row] ?? 1;
  const effect = dealt === 1 ? "full damage" : `×${dealt} damage`;
  return `, ${ROW_LABELS[row]} row: ${effect}`;
}

/** What to tap for a single-target skill. */
export function targetHint(skill: Skill): string {
  if (skill.effect.type === "summon" && skill.effect.anySide) {
    return "tap a highlighted empty cell on either side";
  }
  if (skill.effect.type === "summon" || skill.effect.type === "teleport") {
    return "tap a highlighted empty cell on your side";
  }
  if (skill.effect.type === "heave") return "tap a highlighted unit";
  switch (skill.target) {
    case "self":
      return "tap yourself to use it";
    case "ally":
      return "tap a highlighted ally";
    case "enemy":
      return "tap a highlighted enemy";
    case "any":
      return "tap a highlighted cell";
  }
}

/** "about 24 damage, weak, knocks out" for screen readers. */
export function previewText(p: DamagePreview): string {
  return [
    `about ${p.amount} damage`,
    p.multiplier === 0
      ? "immune"
      : p.multiplier > 1
        ? "weak"
        : p.multiplier < 1
          ? "resists"
          : "",
    p.knocksOut ? "knocks out" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** The badge's classes: gold if weak, grey if resisted, red if KO. */
export function previewClasses(p: DamagePreview): string {
  return [
    "preview",
    p.multiplier > 1 ? "weak" : "",
    p.multiplier < 1 ? "resist" : "",
    p.knocksOut ? "ko" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The badge's text: "~24", "~30 KO", "Immune". */
export function previewLabel(p: DamagePreview): string {
  return `${p.multiplier === 0 ? "Immune" : `~${p.amount}`}${p.knocksOut ? " KO" : ""}`;
}
