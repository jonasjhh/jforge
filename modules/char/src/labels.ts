import {
  DAMAGE_TYPES,
  STAT_NAMES,
  content,
  type StatName,
} from "@jforge/melee/shared";

export const STAT_LABELS: Record<StatName, string> = {
  maxHp: "HP",
  maxMp: "MP",
  attack: "Attack",
  magic: "Magic",
  defense: "Defense",
  spirit: "Spirit",
  speed: "Speed",
};

const title = (text: string) => text[0]!.toUpperCase() + text.slice(1);

export const STAT_OPTIONS = STAT_NAMES.map(
  (stat) => [stat, STAT_LABELS[stat]] as const,
);
export const DAMAGE_OPTIONS = DAMAGE_TYPES.map(
  (type) => [type, title(type)] as const,
);
export const ROW_OPTIONS = [
  ["0", "Front"],
  ["1", "Middle"],
  ["2", "Back"],
] as const;

/** Built-in melee types whose icon a designed type can wear. */
export const PORTRAIT_OPTIONS = [
  ...content.playerTypes,
  ...content.monsters,
].map((def) => [def.id, def.name] as const);
