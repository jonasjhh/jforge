import type { Position, Side } from "@jforge/battle";

// Autob's board, after TFT: each side has BOARD_ROWS rows of
// BOARD_COLUMNS hexes, and the two sides form one arena, the enemy's on
// top. On a side, row 0 is the front, next to the other side. In the
// arena, odd rows sit half a hex to the right ("odd-r" layout).

export const BOARD_ROWS = 4;
export const BOARD_COLUMNS = 7;
export const ARENA_ROWS = BOARD_ROWS * 2;

/** A hex of the arena: row 0 is the enemy's back row, the last the player's. */
export interface Hex {
  col: number;
  row: number;
}

export const isOnBoard = ({ col, row }: Position) =>
  col >= 0 && col < BOARD_COLUMNS && row >= 0 && row < BOARD_ROWS;

/** Where a cell of a side's board lies in the arena. */
export function toArena(side: Side, { col, row }: Position): Hex {
  return side === "player"
    ? { col, row: BOARD_ROWS + row }
    : { col, row: BOARD_ROWS - 1 - row };
}

const cube = ({ col, row }: Hex) => {
  const x = col - (row - (row & 1)) / 2;
  return { x, z: row, y: -x - row };
};

/** Steps between two hexes. */
export function distance(a: Hex, b: Hex): number {
  const p = cube(a);
  const q = cube(b);
  return Math.max(
    Math.abs(p.x - q.x),
    Math.abs(p.y - q.y),
    Math.abs(p.z - q.z),
  );
}

const EVEN_ROW = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [-1, -1],
  [0, 1],
  [-1, 1],
];
const ODD_ROW = [
  [1, 0],
  [-1, 0],
  [1, -1],
  [0, -1],
  [1, 1],
  [0, 1],
];

/** The hexes next to `hex` that lie in the arena. */
export function neighbours(hex: Hex): Hex[] {
  const steps = hex.row & 1 ? ODD_ROW : EVEN_ROW;
  return steps
    .map(([dc, dr]) => ({ col: hex.col + dc!, row: hex.row + dr! }))
    .filter(
      (h) =>
        h.col >= 0 && h.col < BOARD_COLUMNS && h.row >= 0 && h.row < ARENA_ROWS,
    );
}

export const sameHex = (a: Hex, b: Hex) => a.col === b.col && a.row === b.row;
