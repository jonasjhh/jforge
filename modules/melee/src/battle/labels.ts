import {
  ROW_DEALT,
  type BattleState,
  type DamagePreview,
  type Side,
  type Skill,
  type Unit,
} from "../../shared";

// Text and labels for the battle screen, kept apart from the components so
// they can be tested.

const ROW_LABELS = ["front", "middle", "back"];

/** What a damage multiplier means: none, weak (over 1), resist, immune (0). */
type ResistanceKind = "weak" | "resist" | "immune";

export function resistanceKind(multiplier: number): ResistanceKind | undefined {
  if (multiplier === 0) return "immune";
  if (multiplier > 1) return "weak";
  if (multiplier < 1) return "resist";
  return undefined;
}

/** " (weak)" after a damage number in the log and the action caption. */
export function resistanceNote(multiplier: number): string {
  const kind = resistanceKind(multiplier);
  if (kind === "immune") return " (immune)";
  if (kind === "weak") return " (weak)";
  if (kind === "resist") return " (resisted)";
  return "";
}

/** "Victory!", "Defeat…" or "Draw", from the player's point of view. */
export function resultText(winner: Side | null): string {
  if (winner === "player") return "Victory!";
  if (winner === "enemy") return "Defeat…";
  return "Draw";
}

/** A unit's display name, or its id if it isn't in the battle. */
export function unitName(state: BattleState, id: string): string {
  return state.units.find((u) => u.id === id)?.name ?? id;
}

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
    { immune: "immune", weak: "weak", resist: "resists", none: "" }[
      resistanceKind(p.multiplier) ?? "none"
    ],
    p.knocksOut ? "knocks out" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** The badge's classes: gold if weak, grey if resisted or immune, red if KO. */
export function previewClasses(p: DamagePreview): string {
  const kind = resistanceKind(p.multiplier);
  return [
    "preview",
    kind === "weak" ? "weak" : "",
    kind === "resist" || kind === "immune" ? "resist" : "",
    p.knocksOut ? "ko" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The badge's text: "~24", "~30 KO", "Immune". */
export function previewLabel(p: DamagePreview): string {
  return `${resistanceKind(p.multiplier) === "immune" ? "Immune" : `~${p.amount}`}${p.knocksOut ? " KO" : ""}`;
}

/** What to tap to aim an area skill. */
export function aimHint(skill: Skill): string {
  if (skill.effect.type === "shatter") return "tap one of your boulders to aim";
  if (skill.area === "reach") return "tap a highlighted enemy to aim";
  return "tap any cell to aim";
}

/**
 * Who an aimed area skill would hit, from the caster's side: "hits 2
 * enemies" (or "would hit nothing."), and the names of allies in the blast.
 */
export function victimSummary(
  victims: Unit[],
  casterSide: Side,
): { hits: string; friends: string[] } {
  const foes = victims.filter((u) => u.side !== casterSide).length;
  return {
    hits:
      victims.length === 0
        ? "would hit nothing."
        : `hits ${foes} ${foes === 1 ? "enemy" : "enemies"}`,
    friends: victims.filter((u) => u.side === casterSide).map((u) => u.name),
  };
}
