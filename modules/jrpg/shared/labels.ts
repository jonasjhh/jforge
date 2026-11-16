import { GEAR_CATEGORY_NAMES, type Gear } from "@jforge/char/shared";
import type { BattleSetup } from "@jforge/melee/shared";
import type { Encounter } from "./run";

// Wording for the run screens, kept out of the components so it is tested.

const STAT_WORDS = {
  maxHp: "HP",
  maxMp: "MP",
  attack: "attack",
  magic: "magic",
  defense: "defense",
  spirit: "spirit",
  speed: "speed",
} as const;

/** What sort of gear it is: its category ("Polearm"), else its slot. */
export function gearKind(gear: Gear): string {
  return gear.category
    ? GEAR_CATEGORY_NAMES[gear.category]
    : gear.slot[0]!.toUpperCase() + gear.slot.slice(1);
}

/** What a piece of gear does: "+6 attack, x0.9 speed". */
export function gearSummary(gear: Gear): string {
  const parts = gear.bonuses.map((b) =>
    b.op === "add"
      ? `${b.value < 0 ? "−" : "+"}${Math.abs(b.value)} ${STAT_WORDS[b.stat]}`
      : `×${b.value} ${STAT_WORDS[b.stat]}`,
  );
  return parts.join(", ") || "no bonuses";
}

/** A short name for a stop on the map. */
export function encounterLabel(encounter: Encounter): string {
  switch (encounter.kind) {
    case "ally":
      return "Ally";
    case "gear":
      return "Gear";
    case "training":
      return "Training";
    case "battle":
      return encounter.rank === "boss"
        ? "Final battle"
        : encounter.rank === "elite"
          ? "Elite battle"
          : "Battle";
  }
}

/** Who waits in a battle: "3 × Goblin, Wolf". */
export function enemySummary(setup: BattleSetup): string {
  const counts = new Map<string, number>();
  for (const p of setup.placements) {
    if (p.side !== "enemy") continue;
    counts.set(p.def.name, (counts.get(p.def.name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, n]) => (n > 1 ? `${n} × ${name}` : name))
    .join(", ");
}
