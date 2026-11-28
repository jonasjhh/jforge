// @jforge/rules/core: the rules every game shares about content: its
// shapes, gear, the class graph, turning content into melee combatants,
// and skills in words. It imports no content (see README.md, Layout).
export * from "./types";
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
  compileSkill,
  creatureOf,
  SUMMON_DEPTH,
  toCombatantDef,
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
