import type {
  BattleState,
  Cell,
  Position,
  Side,
  SkillArea,
  Unit,
} from "./types";

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

export function isCellOnGrid(cell: Cell): boolean {
  return (cell.side === "player" || cell.side === "enemy") && isOnGrid(cell);
}

export function cellOf(unit: Unit): Cell {
  return { side: unit.side, ...unit.position };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.side === b.side && a.col === b.col && a.row === b.row;
}

/** The unit standing in a cell, alive or not. */
export function unitAt(state: BattleState, cell: Cell): Unit | undefined {
  return state.units.find((u) => sameCell(cellOf(u), cell));
}

// The battlefield is one field 6 rows deep: enemy back row (0) through the
// enemy front (2), then the player front (3) through the player back (5).
function depthOf({ side, row }: Cell): number {
  return side === "enemy" ? GRID_ROWS - 1 - row : GRID_ROWS + row;
}

function cellAtDepth(depth: number, col: number): Cell | null {
  if (depth < 0 || depth >= GRID_ROWS * 2) return null;
  const cell: Cell =
    depth < GRID_ROWS
      ? { side: "enemy", col, row: GRID_ROWS - 1 - depth }
      : { side: "player", col, row: depth - GRID_ROWS };
  return isCellOnGrid(cell) ? cell : null;
}

/** The cells an area covers around `center`, clipped to the battlefield. */
const AREA_OFFSETS: Record<
  Exclude<SkillArea, "single" | "line" | "row" | "reach">,
  [number, number][]
> = {
  // [depth, column] offsets from the aimed cell.
  plus: [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
  square: [-1, 0, 1].flatMap((d) =>
    [-1, 0, 1].map((c): [number, number] => [d, c]),
  ),
};

/** Areas fixed by shape alone; "reach" depends on the caster (see skills). */
export type ShapeArea = Exclude<SkillArea, "reach">;

export function areaCells(center: Cell, area: ShapeArea): Cell[] {
  if (area === "single") return [center];
  if (area === "line") {
    // The aimed cell and the one directly behind it, on the same side.
    const behind = { ...center, row: center.row + 1 };
    return isCellOnGrid(behind) ? [center, behind] : [center];
  }
  if (area === "row") {
    // Every cell of the aimed row, on the aimed side only.
    return Array.from({ length: GRID_COLUMNS }, (_, col) => ({
      ...center,
      col,
    }));
  }
  const depth = depthOf(center);
  const offsets = AREA_OFFSETS[area];
  return offsets.flatMap(([dDepth, dCol]) => {
    const cell = cellAtDepth(depth + dDepth, center.col + dCol);
    return cell ? [cell] : [];
  });
}
