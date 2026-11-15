// Melee's public API, importable by other modules as "@jforge/melee/shared".
export * from "./types";
export { GRID_COLUMNS, GRID_ROWS, MAX_PARTY_SIZE, isOnGrid } from "./grid";
export { effectiveStat, isAlive } from "./stats";
export { GAUGE_FULL, fillRate } from "./timeline";
export { DEFENSE_K, physicalDamage } from "./damage";
export { act, advance, createBattle, getUnit, validateCommand } from "./battle";
export { simulate, type BattleSummary } from "./simulate";
export * as content from "./content";
