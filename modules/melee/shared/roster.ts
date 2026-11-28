import type { EncounterPools } from "./encounters";
import { DAMAGE_TYPES, STAT_NAMES, type CombatantDef } from "./types";

// Combatants made outside melee (compiled from @jforge/content by
// @jforge/rules) arrive as a roster: plain CombatantDefs for the party and
// for the monster pool. Melee owns the format; the libs depend on melee and
// never the other way round.

/** A roster: the same shape encounters are built from. */
export type Roster = EncounterPools;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown) =>
  v === "any" || (typeof v === "number" && Number.isFinite(v) && v >= 0);

function isWeapon(v: unknown): boolean {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    isCount(v.columns) &&
    isCount(v.depth) &&
    DAMAGE_TYPES.includes(v.damageType as never) &&
    (v.kind === "melee" || v.kind === "ranged")
  );
}

function isSkill(v: unknown): boolean {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.mpCost === "number" &&
    typeof v.target === "string" &&
    typeof v.area === "string" &&
    isRecord(v.effect) &&
    typeof v.effect.type === "string"
  );
}

/** Whether `v` has everything a battle needs from a combatant. */
export function isCombatantDef(v: unknown): v is CombatantDef {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.name !== "string") {
    return false;
  }
  const stats = v.stats;
  if (!isRecord(stats)) return false;
  const numbers = STAT_NAMES.every(
    (s) => typeof stats[s] === "number" && Number.isFinite(stats[s]),
  );
  if (!numbers || (stats.maxHp as number) < 1) return false;
  if (!isWeapon(v.weapon)) return false;
  return v.skills === undefined
    ? true
    : Array.isArray(v.skills) && v.skills.every(isSkill);
}
