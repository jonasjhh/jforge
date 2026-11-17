import { content } from "@jforge/melee/shared";

export { DAMAGE_OPTIONS, STAT_LABELS, STAT_OPTIONS } from "../shared";
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
