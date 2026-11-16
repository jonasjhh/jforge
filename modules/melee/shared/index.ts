// Melee's public API, importable by other modules as "@jforge/melee/shared".
export * from "./types";
export {
  GRID_COLUMNS,
  GRID_ROWS,
  MAX_PARTY_SIZE,
  areaCells,
  cellOf,
  isCellOnGrid,
  isOnGrid,
  sameCell,
  unitAt,
} from "./grid";
export { effectiveStat, isAlive } from "./stats";
export { canReach, reachableTargets } from "./reach";
export {
  canAfford,
  skillArea,
  skillCells,
  skillVictims,
  validateSkill,
} from "./skills";
export { MOVE_GAUGE_LEFT, validateMove } from "./move";
export { AMBUSH_POWER, isStealthed } from "./stealth";
export { TRAIT_RESISTANCES, resistancesFor } from "./traits";
export { applyStatus } from "./status";
export { GAUGE_FULL, fillRate, turnOrder } from "./timeline";
export {
  DEFENSE_K,
  magicalHit,
  physicalHit,
  resistance,
  rowFactor,
  ROW_DEALT,
  ROW_TAKEN,
  type Hit,
} from "./damage";
export {
  act,
  advance,
  createBattle,
  getUnit,
  validateCommand,
  type AdvanceOptions,
} from "./battle";
export { previewDamage, type DamagePreview } from "./preview";
export { simulate, type BattleSummary } from "./simulate";
export { DEFAULT_TARGETING, targetScore } from "./ai";
export {
  DIFFICULTIES,
  THREAT_BUDGET,
  randomEncounter,
  type Difficulty,
  type EncounterPools,
} from "./encounters";
export * as content from "./content";
