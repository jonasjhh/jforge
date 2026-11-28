import { archetypeOf } from "@jforge/rules/core";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  isOnGrid,
  type Position,
} from "@jforge/battle";
import type { Run } from "./run";

// Where the party stands when a battle starts. Members the player hasn't
// placed stand in their class's preferred row, filling from the middle.

/** Columns in the order they fill: the middle first, then outward. */
const COLUMN_ORDER = Array.from({ length: GRID_COLUMNS }, (_, i) => i).sort(
  (a, b) =>
    Math.abs(a - (GRID_COLUMNS - 1) / 2) -
      Math.abs(b - (GRID_COLUMNS - 1) / 2) || a - b,
);

const key = (p: Position) => `${p.col},${p.row}`;

/** The free cell nearest `preferredRow`, middle columns first. */
function freeCell(preferredRow: number, taken: Set<string>): Position {
  const rows = Array.from({ length: GRID_ROWS }, (_, row) => row).sort(
    (a, b) => Math.abs(a - preferredRow) - Math.abs(b - preferredRow) || a - b,
  );
  for (const row of rows) {
    for (const col of COLUMN_ORDER) {
      if (!taken.has(key({ col, row }))) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}

/**
 * Every party member's cell, by character id: where the player put them
 * (if that is a cell of the grid nobody placed earlier holds), else a
 * default cell.
 */
export function formationOf(run: Run): Record<string, Position> {
  const cells: Record<string, Position> = {};
  const taken = new Set<string>();
  for (const member of run.party) {
    const chosen = run.formation?.[member.id];
    if (chosen && isOnGrid(chosen) && !taken.has(key(chosen))) {
      cells[member.id] = { col: chosen.col, row: chosen.row };
      taken.add(key(chosen));
    }
  }
  for (const member of run.party) {
    if (cells[member.id]) continue;
    const row = archetypeOf(run.library, member)?.preferredRow ?? 0;
    const cell = freeCell(row, taken);
    cells[member.id] = cell;
    taken.add(key(cell));
  }
  return cells;
}

/**
 * Moves a member to a cell; whoever stands there swaps places with them.
 * Not during a battle the party has acted in.
 */
export function moveMember(run: Run, characterId: string, to: Position): Run {
  const cells = formationOf(run);
  const from = cells[characterId];
  if (run.committed || !from || !isOnGrid(to)) return run;
  if (key(from) === key(to)) return run;
  const formation = { ...cells, [characterId]: { col: to.col, row: to.row } };
  const other = run.party.find(
    (c) => c.id !== characterId && key(cells[c.id]!) === key(to),
  );
  if (other) formation[other.id] = from;
  return { ...run, formation };
}
