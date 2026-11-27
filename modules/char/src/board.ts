import { sourcesOf, type Archetype, type Library } from "../shared";

// Where classes sit on the Paths board. The layout belongs to this device
// only: it is not part of the library and is not exported. A class is on
// the board when it has a place or any link; one with links but no place
// (a library imported from elsewhere) is placed by how deep it sits.

export interface Point {
  x: number;
  y: number;
}

/** Saved places on the board, by class id. */
export type Places = Record<string, Point>;

export const COLUMN = 240;
export const ROW = 110;

const classes = (library: Library) =>
  library.archetypes.filter((a) => a.kind === "class");

const isLinked = (library: Library, a: Archetype) =>
  sourcesOf(library, a).length > 0 ||
  classes(library).some((b) => b.comesFrom?.includes(a.id));

/** The classes on the board, each at its place. */
export function boardPlaces(library: Library, places: Places): Places {
  const onBoard = classes(library).filter(
    (a) => places[a.id] || isLinked(library, a),
  );
  const depth = new Map<string, number>();
  const depthOf = (a: Archetype): number => {
    const known = depth.get(a.id);
    if (known !== undefined) return known;
    depth.set(a.id, 0); // The graph has no loops; this only guards bad data.
    const d = Math.max(0, ...sourcesOf(library, a).map((s) => depthOf(s) + 1));
    depth.set(a.id, d);
    return d;
  };
  const result: Places = {};
  const used = new Map<number, number>();
  for (const a of onBoard) {
    if (places[a.id]) {
      result[a.id] = places[a.id];
      continue;
    }
    const column = depthOf(a);
    const row = used.get(column) ?? 0;
    used.set(column, row + 1);
    result[a.id] = { x: column * COLUMN, y: row * ROW };
  }
  return result;
}

/** The classes waiting in the tray: those not on the board. */
export function trayClasses(library: Library, places: Places): Archetype[] {
  const onBoard = boardPlaces(library, places);
  return classes(library).filter((a) => !onBoard[a.id]);
}

/** Whether `value` is a saved set of places. */
export function isPlaces(value: unknown): value is Places {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        Number.isFinite((p as Point).x) &&
        Number.isFinite((p as Point).y),
    )
  );
}

/** Grid steps around a spot, nearest first, rows before columns. */
const STEPS = Array.from({ length: 81 }, (_, i) => ({
  dx: (i % 9) - 4,
  dy: Math.floor(i / 9) - 4,
})).sort(
  (a, b) =>
    Math.abs(a.dx) - Math.abs(b.dx) ||
    Math.abs(a.dy) - Math.abs(b.dy) ||
    b.dy - a.dy ||
    b.dx - a.dx,
);

/**
 * The spot nearest `near`, on a grid of rows and columns around it, that no
 * card in `taken` covers, so a newly placed class hides no other. Rows come
 * first: the board is wider in its links than in its classes.
 */
export function freeSpot(near: Point, taken: Point[]): Point {
  const covered = (p: Point) =>
    taken.some(
      (t) =>
        Math.abs(t.x - p.x) < COLUMN * 0.8 && Math.abs(t.y - p.y) < ROW * 0.8,
    );
  for (const { dx, dy } of STEPS) {
    const spot = { x: near.x + dx * COLUMN, y: near.y + dy * ROW };
    if (!covered(spot)) return spot;
  }
  return near;
}
