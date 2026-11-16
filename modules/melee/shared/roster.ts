import { monsters, playerTypes } from "./content";
import type { EncounterPools } from "./encounters";
import { DAMAGE_TYPES, STAT_NAMES, type CombatantDef } from "./types";

// Combatants designed outside melee (in the char module) arrive as a
// roster: plain CombatantDefs for the party and for the monster pool, saved
// under one storage key that every module on this origin can read. Melee
// owns the format, so char depends on melee and never the other way round.

/** Where the imported roster is kept in the browser. */
export const ROSTER_STORAGE_KEY = "jforge.melee.roster";

/** An imported roster: the same shape encounters are built from. */
export type Roster = EncounterPools;

export const EMPTY_ROSTER: Roster = { party: [], monsters: [] };

/** The part of localStorage a roster needs; a test can pass a plain object. */
export interface RosterStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

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

/**
 * Reads a saved roster. Anything that is not a well-formed roster (no
 * text, broken JSON, a combatant missing a stat) gives null: melee then
 * plays with its built-in types.
 */
export function parseRoster(text: string | null): Roster | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const { party, monsters: pool } = data;
  if (!Array.isArray(party) || !Array.isArray(pool)) return null;
  if (![...party, ...pool].every(isCombatantDef)) return null;
  return { party, monsters: pool };
}

/** The roster saved in `store`, or an empty one. Never throws. */
export function readRoster(store: Pick<RosterStore, "getItem">): Roster {
  try {
    return parseRoster(store.getItem(ROSTER_STORAGE_KEY)) ?? EMPTY_ROSTER;
  } catch {
    return EMPTY_ROSTER;
  }
}

/** Saves a roster for melee and jrpg. False if the store refused it. */
export function writeRoster(store: RosterStore, roster: Roster): boolean {
  try {
    store.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
    return true;
  } catch {
    return false;
  }
}

/**
 * The pools an encounter draws from. With `custom`, each imported side
 * replaces the built-in one; a side nothing was imported for stays built in,
 * so custom heroes can fight stock monsters and the other way round.
 */
export function encounterPools(
  roster: Roster,
  custom: boolean,
): EncounterPools {
  return {
    party: custom && roster.party.length > 0 ? roster.party : playerTypes,
    monsters: custom && roster.monsters.length > 0 ? roster.monsters : monsters,
  };
}
