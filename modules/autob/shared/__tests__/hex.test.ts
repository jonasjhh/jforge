import { describe, expect, it } from "vitest";
import {
  ARENA_ROWS,
  BOARD_COLUMNS,
  BOARD_ROWS,
  distance,
  isOnBoard,
  neighbours,
  sameHex,
  toArena,
} from "../hex";

describe("isOnBoard", () => {
  it.each([
    [{ col: 0, row: 0 }, true],
    [{ col: BOARD_COLUMNS - 1, row: BOARD_ROWS - 1 }, true],
    [{ col: -1, row: 0 }, false],
    [{ col: BOARD_COLUMNS, row: 0 }, false],
    [{ col: 0, row: -1 }, false],
    [{ col: 0, row: BOARD_ROWS }, false],
  ])(
    "given the cell %o, when it is checked, then it is on the board: %s",
    (cell, on) => {
      const result = isOnBoard(cell);

      expect(result).toBe(on);
    },
  );
});

describe("toArena", () => {
  it("given the player's front row, when it is put in the arena, then it is just below the middle", () => {
    const hex = toArena("player", { col: 2, row: 0 });

    expect(hex).toEqual({ col: 2, row: BOARD_ROWS });
  });

  it("given the enemy's front row, when it is put in the arena, then it is just above the middle", () => {
    const hex = toArena("enemy", { col: 2, row: 0 });

    expect(hex).toEqual({ col: 2, row: BOARD_ROWS - 1 });
  });

  it("given the enemy's back row, when it is put in the arena, then it is the top row", () => {
    const hex = toArena("enemy", { col: 2, row: BOARD_ROWS - 1 });

    expect(hex).toEqual({ col: 2, row: 0 });
  });
});

describe("distance", () => {
  it("given the same hex twice, when the distance is measured, then it is 0", () => {
    const steps = distance({ col: 3, row: 3 }, { col: 3, row: 3 });

    expect(steps).toBe(0);
  });

  it("given the two front rows facing each other, when the distance is measured, then it is 1", () => {
    const steps = distance({ col: 3, row: 3 }, { col: 3, row: 4 });

    expect(steps).toBe(1);
  });

  it("given an odd row, when the distance to the hex below and right is measured, then it is 1", () => {
    const steps = distance({ col: 3, row: 3 }, { col: 4, row: 4 });

    expect(steps).toBe(1);
  });

  it("given an odd row, when the distance to the hex below and left is measured, then it is 2", () => {
    const steps = distance({ col: 3, row: 3 }, { col: 2, row: 4 });

    expect(steps).toBe(2);
  });

  it("given the two back rows, when the distance is measured, then it is the arena's height less one", () => {
    const steps = distance({ col: 3, row: 0 }, { col: 3, row: ARENA_ROWS - 1 });

    expect(steps).toBe(ARENA_ROWS - 1);
  });
});

describe("neighbours", () => {
  it("given a hex in the middle, when its neighbours are listed, then all six are one step away", () => {
    const hex = { col: 3, row: 3 };

    const around = neighbours(hex);

    expect(around).toHaveLength(6);
    expect(around.every((h) => distance(hex, h) === 1)).toBe(true);
  });

  it("given an even-row middle hex, when its neighbours are listed, then all six are one step away", () => {
    const hex = { col: 3, row: 4 };

    const around = neighbours(hex);

    expect(around).toHaveLength(6);
    expect(around.every((h) => distance(hex, h) === 1)).toBe(true);
  });

  it("given a corner hex, when its neighbours are listed, then only those in the arena are", () => {
    const around = neighbours({ col: 0, row: 0 });

    expect(around).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });
});

describe("sameHex", () => {
  it("given two hexes in different columns, when they are compared, then they differ", () => {
    const same = sameHex({ col: 1, row: 2 }, { col: 2, row: 2 });

    expect(same).toBe(false);
  });
});
