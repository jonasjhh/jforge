import { describe, expect, it } from "vitest";
import { BOARD_ROWS } from "../../shared";
import { hexName } from "../hexName";

describe("hexName", () => {
  it("given the player's front row, when the hex is named, then it says so with its column", () => {
    const name = hexName({ col: 3, row: BOARD_ROWS });

    expect(name).toBe("front row, column 4");
  });

  it("given the arena's top row, when the hex is named, then it is the enemy's back row", () => {
    const name = hexName({ col: 0, row: 0 });

    expect(name).toBe("enemy back row, column 1");
  });
});
