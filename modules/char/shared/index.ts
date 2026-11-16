// Char's public API, importable by other modules as "@jforge/char/shared".
export * from "./types";
export {
  MAX_LEVEL,
  clampLevel,
  gainXp,
  statsAtLevel,
  xpToNext,
  type Progress,
} from "./progression";
export { applyBonuses, equip, equippedGear, unequip } from "./gear";
export {
  archetypeOf,
  characterStats,
  characterWeapon,
  compileRoster,
  toCombatantDef,
  unlockedSkills,
} from "./compile";
export {
  EDITABLE_EFFECTS,
  EFFECT_LABELS,
  defaultEffect,
  defaultTarget,
  effectSummary,
  isEditable,
  skillProblems,
  type EditableEffect,
} from "./skills";
export {
  blankArchetype,
  blankCharacter,
  blankGear,
  blankSkill,
  emptyLibrary,
  LIBRARY_STORAGE_KEY,
  flatStats,
  nextId,
  parseLibrary,
  remove,
  upsert,
  type Collection,
} from "./library";
export { starterLibrary } from "./starter";
export {
  MELEE_CLASS_LEVEL,
  classFromMelee,
  meleeClassId,
  meleeClasses,
  withMeleeClasses,
} from "./melee";
