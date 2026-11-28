import { DAMAGE_TYPES, STAT_NAMES, type Creature } from "./format";

// Checks a creature made elsewhere (compiled, or read from a save) before
// a battle takes it.

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

/** Whether `v` has everything a battle needs from a creature. */
export function isCreature(v: unknown): v is Creature {
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
