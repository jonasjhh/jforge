import { describe, expect, it } from "vitest";
import {
  blankArchetype,
  emptyLibrary,
  type Archetype,
  type Library,
} from "../../shared";
import {
  COLUMN,
  ROW,
  boardPlaces,
  freeSpot,
  isPlaces,
  trayClasses,
} from "../board";

const type = (
  id: string,
  comesFrom?: string[],
  kind: Archetype["kind"] = "class",
): Archetype => ({
  ...blankArchetype(id, kind),
  ...(comesFrom ? { comesFrom } : {}),
});

/** Fighter leads to Paladin, which leads to Templar; Mage and a goblin alone. */
const library = (): Library => ({
  ...emptyLibrary(),
  archetypes: [
    type("fighter"),
    type("paladin", ["fighter"]),
    type("templar", ["paladin"]),
    type("mage"),
    type("goblin", undefined, "enemy"),
  ],
});

describe("boardPlaces", () => {
  it("given linked classes with no places, when the board is laid out, then each sits in the column of its depth", () => {
    const lib = library();

    const places = boardPlaces(lib, {});

    expect(places).toEqual({
      fighter: { x: 0, y: 0 },
      paladin: { x: COLUMN, y: 0 },
      templar: { x: 2 * COLUMN, y: 0 },
    });
  });

  it("given a saved place, when the board is laid out, then that class keeps it and an unlinked one with a place is on the board", () => {
    const lib = library();

    const places = boardPlaces(lib, {
      paladin: { x: 5, y: 6 },
      mage: { x: 7, y: 8 },
    });

    expect(places.paladin).toEqual({ x: 5, y: 6 });
    expect(places.mage).toEqual({ x: 7, y: 8 });
  });

  it("given two classes at the same depth with no places, when the board is laid out, then they stack in rows", () => {
    const lib = library();
    lib.archetypes.push(type("berserker", ["fighter"]));

    const places = boardPlaces(lib, {});

    expect(places.berserker).toEqual({ x: COLUMN, y: ROW });
  });

  it("given a place for an enemy type or a class that is gone, when the board is laid out, then it is left out", () => {
    const lib = library();

    const places = boardPlaces(lib, {
      goblin: { x: 1, y: 1 },
      gone: { x: 2, y: 2 },
    });

    expect(Object.keys(places)).toEqual(["fighter", "paladin", "templar"]);
  });
});

describe("trayClasses", () => {
  it("given a mage with no links or place, when the tray is read, then it holds only the mage", () => {
    const lib = library();

    const tray = trayClasses(lib, {});

    expect(tray.map((a) => a.id)).toEqual(["mage"]);
  });
});

describe("isPlaces", () => {
  it.each([
    [{}, true],
    [{ a: { x: 1, y: 2 } }, true],
    [{ a: { x: 1 } }, false],
    [{ a: { x: Number.NaN, y: 2 } }, false],
    [{ a: null }, false],
    [[], false],
    [null, false],
    ["places", false],
  ])("given %j, when it is checked, then it is %s", (value, expected) => {
    const ok = isPlaces(value);

    expect(ok).toBe(expected);
  });
});

describe("freeSpot", () => {
  it("given an empty board, when a spot is sought, then it is the one asked for", () => {
    const near = { x: 10, y: 20 };

    const spot = freeSpot(near, []);

    expect(spot).toEqual(near);
  });

  it("given a card on the spot and one just below, when a spot is sought, then it is the one just above", () => {
    const near = { x: 0, y: 0 };

    const spot = freeSpot(near, [near, { x: 0, y: ROW }]);

    expect(spot).toEqual({ x: 0, y: -ROW });
  });

  it("given the whole column taken, when a spot is sought, then it is in the next column", () => {
    const near = { x: 0, y: 0 };
    const column = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((r) => ({
      x: 0,
      y: r * ROW,
    }));

    const spot = freeSpot(near, column);

    expect(spot).toEqual({ x: COLUMN, y: 0 });
  });
});
