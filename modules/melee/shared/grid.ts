import type { Position, Side } from "./types";

export const GRID_COLUMNS = 5;
export const GRID_ROWS = 3;
export const MAX_PARTY_SIZE = 5;

export function isOnGrid({ col, row }: Position): boolean {
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= 0 &&
    col < GRID_COLUMNS &&
    row >= 0 &&
    row < GRID_ROWS
  );
}

export function unitId(side: Side, { col, row }: Position): string {
  return `${side}-${col}-${row}`;
}
