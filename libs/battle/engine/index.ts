// @jforge/battle: the battle engine every grid game shares (time-based
// turns on a 5x3 grid). It takes creatures from any game, with that
// game's targeting and threat; the screen is "@jforge/battle/screen".
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
export { attackTargets, canReach, reachableTargets } from "./reach";
export {
  canAfford,
  skillArea,
  skillCells,
  skillVictims,
  validateSkill,
} from "./skills";
export { MOVE_GAUGE_LEFT, validateMove } from "./move";
export { DEFEND_FACTOR, WAIT_GAUGE_LEFT } from "./stance";
export { ambushPower, isHidden, isStealthed } from "./stealth";
export { isTaunting } from "./taunt";
export { guardianOf, hitVictim } from "./guard";
export { applyStatus } from "./status";
export { GAUGE_FULL, fillRate, turnOrder } from "./timeline";
export {
  DEFENCE_K,
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
export { estimateThreat } from "./threat";
export { createRandom } from "./rng";
export { POISON } from "./poison";
export {
  DIFFICULTIES,
  MAX_BACK_PER_FRONT,
  THREAT_BUDGET,
  isBackLiner,
  randomEncounter,
  type Difficulty,
  type EncounterPools,
} from "./encounters";
