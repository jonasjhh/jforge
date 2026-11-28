import type { StatName } from "@jforge/rules/core";

export const STAT_LABELS: Record<StatName, string> = {
  maxHp: "HP",
  maxMp: "MP",
  attack: "Attack",
  magic: "Magic",
  defence: "Defence",
  spirit: "Spirit",
  speed: "Speed",
};

export const ROW_NAMES = ["Front", "Middle", "Back"] as const;

/** "1 skill", "3 skills". */
export const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Each kind of archetype: its tab, what one is called, and its label. */
export const KINDS = {
  class: { tab: "Classes", noun: "class", label: "Class" },
  enemy: { tab: "Enemies", noun: "enemy type", label: "Enemy type" },
  summon: { tab: "Summons", noun: "summon", label: "Summon" },
} as const;
