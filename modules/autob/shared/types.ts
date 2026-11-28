import type { Creature } from "@jforge/rules/core";

// Autob's own unit and board types: it shares the design format (rules)
// with the other games, and nothing of their battles.

export type Side = "player" | "enemy";

/** A hex on one side's board. Row 0 is the front. */
export interface Position {
  col: number;
  row: number;
}

/** A creature as autob fields it: with the threat a pack spends on it. */
export interface UnitDef extends Creature {
  threat?: number;
}

/** Higher K means defence matters less. */
export const DEFENCE_K = 50;
