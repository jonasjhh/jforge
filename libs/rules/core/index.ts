// @jforge/rules/core: the rules every game shares about content: the
// design format, its shapes, gear, the class graph, turning content into
// creatures, and skills in words. It imports nothing of jforge's (see
// README.md, Layout).
export * from "./format";
export * from "./types";
export { TRAIT_RESISTANCES, resistancesFor } from "./traits";
export { STRENGTH_DEFAULTS, strengthsOf, type Strengths } from "./strengths";
export { isCreature } from "./creature";
export { tune } from "./tune";
export { POISON } from "./statuses";
export {
  applyBonuses,
  canUse,
  canWear,
  equip,
  equippedGear,
  unequip,
} from "./gear";
export {
  archetypeOf,
  archetypeSkills,
  characterStats,
  characterWeapon,
  compileRoster,
  type Roster,
  compileSkill,
  creatureOf,
  SUMMON_DEPTH,
  toCreature,
} from "./compile";
export { effectSummary, skillProblems } from "./skills";
export {
  blankArchetype,
  blankCharacter,
  emptyLibrary,
  flatStats,
  parseLibrary,
} from "./library";
export {
  graphProblems,
  isBaseClass,
  nextClasses,
  sourcesOf,
} from "./classGraph";
